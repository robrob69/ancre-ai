"""Chat service with RAG and streaming."""

import json
from collections.abc import AsyncGenerator
from uuid import UUID, uuid4

from openai import AsyncOpenAI

from app.config import get_settings
from app.schemas.chat import ChatStreamEvent, Citation
from app.services.retrieval import RetrievalService, RetrievedChunk

settings = get_settings()


class ChatService:
    """Service for RAG-powered chat with streaming."""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.retrieval = RetrievalService()
        self.model = settings.llm_model
        self.max_tokens = settings.llm_max_tokens

    def _build_system_prompt(
        self,
        custom_prompt: str | None,
        context: str,
    ) -> str:
        """Build system prompt with context."""
        base_prompt = custom_prompt or (
            "You are a helpful assistant that answers questions based on the provided context. "
            "Always cite your sources by mentioning the document name and page number when available. "
            "If you cannot find the answer in the context, say so clearly."
        )
        
        if context:
            return f"""{base_prompt}

Use the following context to answer questions. Cite the sources when you use information from them.

CONTEXT:
{context}

Remember to cite your sources (document name and page number) when using information from the context."""
        
        return base_prompt

    def _extract_citations(
        self,
        chunks: list[RetrievedChunk],
        response_text: str,
    ) -> list[Citation]:
        """Extract citations from chunks that were likely used."""
        # Simple heuristic: include chunks that have high relevance
        # In production, you might want more sophisticated citation extraction
        citations = []
        
        for chunk in chunks[:5]:  # Top 5 most relevant
            # Check if document is mentioned in response
            if chunk.score > 0.5:  # High confidence chunks
                citations.append(Citation(
                    chunk_id=UUID(chunk.chunk_id),
                    document_id=UUID(chunk.document_id),
                    document_filename=chunk.document_filename,
                    page_number=chunk.page_number,
                    excerpt=chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                    score=chunk.score,
                ))
        
        return citations

    async def chat(
        self,
        message: str,
        tenant_id: UUID,
        collection_ids: list[UUID],
        system_prompt: str | None = None,
        conversation_history: list[dict] | None = None,
    ) -> tuple[str, list[Citation], int, int]:
        """
        Non-streaming chat.
        
        Returns:
            Tuple of (response, citations, tokens_input, tokens_output)
        """
        # Retrieve relevant chunks
        chunks = await self.retrieval.retrieve(
            query=message,
            tenant_id=tenant_id,
            collection_ids=collection_ids,
        )
        
        # Build context
        context = self.retrieval.build_context(chunks)
        
        # Build messages
        messages = []
        messages.append({
            "role": "system",
            "content": self._build_system_prompt(system_prompt, context),
        })
        
        # Add conversation history
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": message})
        
        # Call LLM
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
        )
        
        response_text = response.choices[0].message.content or ""
        tokens_input = response.usage.prompt_tokens if response.usage else 0
        tokens_output = response.usage.completion_tokens if response.usage else 0
        
        # Extract citations
        citations = self._extract_citations(chunks, response_text)
        
        return response_text, citations, tokens_input, tokens_output

    async def chat_stream(
        self,
        message: str,
        tenant_id: UUID,
        collection_ids: list[UUID],
        system_prompt: str | None = None,
        conversation_history: list[dict] | None = None,
    ) -> AsyncGenerator[ChatStreamEvent, None]:
        """
        Streaming chat with SSE events.
        
        Yields:
            ChatStreamEvent objects for SSE
        """
        # Retrieve relevant chunks
        chunks = await self.retrieval.retrieve(
            query=message,
            tenant_id=tenant_id,
            collection_ids=collection_ids,
        )
        
        # Build context
        context = self.retrieval.build_context(chunks)
        
        # Yield start event with chunk info
        yield ChatStreamEvent(
            event="start",
            data={"chunks_found": len(chunks)},
        )
        
        # Build messages
        messages = []
        messages.append({
            "role": "system",
            "content": self._build_system_prompt(system_prompt, context),
        })
        
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": message})
        
        # Stream LLM response
        full_response = ""
        tokens_input = 0
        tokens_output = 0
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                stream=True,
                stream_options={"include_usage": True},
            )
            
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield ChatStreamEvent(event="token", data=token)
                
                # Get usage from final chunk
                if chunk.usage:
                    tokens_input = chunk.usage.prompt_tokens
                    tokens_output = chunk.usage.completion_tokens
            
            # Yield citations
            citations = self._extract_citations(chunks, full_response)
            yield ChatStreamEvent(
                event="citations",
                data=[c.model_dump() for c in citations],
            )
            
            # Yield done event
            yield ChatStreamEvent(
                event="done",
                data={
                    "tokens_input": tokens_input,
                    "tokens_output": tokens_output,
                },
            )
            
        except Exception as e:
            yield ChatStreamEvent(event="error", data=str(e))


# Singleton instance
chat_service = ChatService()
