"""Chat service with RAG, streaming, and Generative UI blocks."""

import json
import logging
from collections.abc import AsyncGenerator
from uuid import UUID, uuid4

from openai import AsyncOpenAI

from app.config import get_settings
from app.schemas.chat import ChatStreamEvent, Citation
from app.services.retrieval import RetrievalService, RetrievedChunk

settings = get_settings()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool definitions for Generative UI blocks — one per block type
# ---------------------------------------------------------------------------
BLOCK_TOOL_KPI = {
    "type": "function",
    "function": {
        "name": "renderKpiCards",
        "strict": True,
        "description": "Affiche des cartes KPI. Utilise cet outil quand ta réponse contient des métriques, chiffres clés ou indicateurs.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": ["string", "null"], "description": "Titre optionnel du bloc KPI"},
                "items": {
                    "type": "array",
                    "description": "Liste des KPIs à afficher",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string", "description": "Nom du KPI"},
                            "value": {"type": "string", "description": "Valeur du KPI"},
                            "delta": {"type": ["string", "null"], "description": "Variation (ex: +5%, -2%)"},
                        },
                        "required": ["label", "value", "delta"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["title", "items"],
            "additionalProperties": False,
        },
    },
}

BLOCK_TOOL_TABLE = {
    "type": "function",
    "function": {
        "name": "renderTable",
        "strict": True,
        "description": "Affiche un tableau comparatif. Utilise cet outil quand ta réponse compare des options ou présente des données tabulaires.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": ["string", "null"], "description": "Titre optionnel du tableau"},
                "columns": {
                    "type": "array",
                    "description": "Noms des colonnes",
                    "items": {"type": "string"},
                },
                "rows": {
                    "type": "array",
                    "description": "Lignes du tableau (chaque ligne = array de strings)",
                    "items": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
            "required": ["title", "columns", "rows"],
            "additionalProperties": False,
        },
    },
}

BLOCK_TOOL_STEPS = {
    "type": "function",
    "function": {
        "name": "renderSteps",
        "strict": True,
        "description": "Affiche des étapes séquentielles. Utilise cet outil quand ta réponse décrit un plan, une procédure ou des étapes.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": ["string", "null"], "description": "Titre optionnel du bloc"},
                "steps": {
                    "type": "array",
                    "description": "Liste des étapes",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Titre de l'étape"},
                            "description": {"type": ["string", "null"], "description": "Description de l'étape"},
                        },
                        "required": ["title", "description"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["title", "steps"],
            "additionalProperties": False,
        },
    },
}

BLOCK_TOOL_CALLOUT = {
    "type": "function",
    "function": {
        "name": "renderCallout",
        "strict": True,
        "description": "Affiche une alerte ou un callout. Utilise cet outil pour alerter, avertir ou mettre en avant un point important.",
        "parameters": {
            "type": "object",
            "properties": {
                "tone": {
                    "type": "string",
                    "enum": ["info", "warning", "success", "danger"],
                    "description": "Ton du callout",
                },
                "title": {"type": ["string", "null"], "description": "Titre optionnel"},
                "message": {"type": "string", "description": "Message du callout"},
            },
            "required": ["tone", "title", "message"],
            "additionalProperties": False,
        },
    },
}

BLOCK_TOOLS = [BLOCK_TOOL_KPI, BLOCK_TOOL_TABLE, BLOCK_TOOL_STEPS, BLOCK_TOOL_CALLOUT]

# Map tool function name → block type for the frontend
_TOOL_NAME_TO_BLOCK_TYPE = {
    "renderKpiCards": "kpi_cards",
    "renderTable": "table",
    "renderSteps": "steps",
    "renderCallout": "callout",
}

BLOCK_INSTRUCTIONS = """
INSTRUCTIONS POUR LES BLOCS VISUELS :
Tu disposes de 4 outils pour afficher des blocs structurés dans le chat :
- `renderKpiCards` → quand ta réponse contient des KPIs, métriques ou chiffres comparatifs
- `renderSteps` → quand ta réponse décrit un plan, une procédure ou des étapes séquentielles
- `renderTable` → quand ta réponse compare des options ou présente des données tabulaires
- `renderCallout` → quand tu dois alerter, avertir ou mettre en avant un point important
Garde le texte concis et complémentaire ; mets la structure dans les blocs.
Ne pas inventer de données manquantes ; si une valeur n'est pas disponible, indique "N/A".
Tu peux combiner texte et plusieurs blocs dans une même réponse.
"""


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
            prompt = f"""{base_prompt}

Use the following context to answer questions. Cite the sources when you use information from them.

CONTEXT:
{context}

Remember to cite your sources (document name and page number) when using information from the context."""
        else:
            prompt = base_prompt

        return prompt + BLOCK_INSTRUCTIONS

    def _extract_citations(
        self,
        chunks: list[RetrievedChunk],
        response_text: str,
    ) -> list[Citation]:
        """Extract citations from chunks that were likely used."""
        citations = []

        for chunk in chunks[:5]:  # Top 5 most relevant
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

    @staticmethod
    def _parse_tool_calls_to_blocks(tool_calls: list) -> list[dict]:
        """Parse OpenAI tool_calls into block dicts."""
        blocks = []
        for tc in tool_calls:
            block_type = _TOOL_NAME_TO_BLOCK_TYPE.get(tc.function.name)
            if block_type is None:
                continue
            try:
                payload = json.loads(tc.function.arguments)
                blocks.append({
                    "id": str(uuid4()),
                    "type": block_type,
                    "payload": payload,
                })
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning("Failed to parse %s args: %s", tc.function.name, e)
                blocks.append({
                    "id": str(uuid4()),
                    "type": "error",
                    "payload": {"message": str(e), "raw": tc.function.arguments[:200]},
                })
        return blocks

    async def chat(
        self,
        message: str,
        tenant_id: UUID,
        collection_ids: list[UUID],
        system_prompt: str | None = None,
        conversation_history: list[dict] | None = None,
    ) -> tuple[str, list[Citation], list[dict], int, int]:
        """
        Non-streaming chat.

        Returns:
            Tuple of (response, citations, blocks, tokens_input, tokens_output)
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

        # Call LLM with tools
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
            tools=BLOCK_TOOLS,
            parallel_tool_calls=True,
        )

        response_text = response.choices[0].message.content or ""
        tokens_input = response.usage.prompt_tokens if response.usage else 0
        tokens_output = response.usage.completion_tokens if response.usage else 0

        # Extract blocks from tool calls
        blocks = []
        if response.choices[0].message.tool_calls:
            blocks = self._parse_tool_calls_to_blocks(
                response.choices[0].message.tool_calls
            )

        # Extract citations
        citations = self._extract_citations(chunks, response_text)

        return response_text, citations, blocks, tokens_input, tokens_output

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
        tool_calls_acc: dict[int, dict] = {}  # index -> {name, arguments}

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                tools=BLOCK_TOOLS,
                parallel_tool_calls=True,
                stream=True,
                stream_options={"include_usage": True},
            )

            async for chunk in stream:
                # Stream text tokens
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield ChatStreamEvent(event="token", data=token)

                # Accumulate tool call arguments
                if chunk.choices and chunk.choices[0].delta.tool_calls:
                    for tc in chunk.choices[0].delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_acc:
                            tool_calls_acc[idx] = {"name": "", "arguments": ""}
                        if tc.function and tc.function.name:
                            tool_calls_acc[idx]["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            tool_calls_acc[idx]["arguments"] += tc.function.arguments

                # Get usage from final chunk
                if chunk.usage:
                    tokens_input = chunk.usage.prompt_tokens
                    tokens_output = chunk.usage.completion_tokens

            # After stream ends: emit blocks from accumulated tool calls
            for tc_data in tool_calls_acc.values():
                block_type = _TOOL_NAME_TO_BLOCK_TYPE.get(tc_data["name"])
                if block_type is None:
                    continue
                try:
                    payload = json.loads(tc_data["arguments"])
                    block = {
                        "id": str(uuid4()),
                        "type": block_type,
                        "payload": payload,
                    }
                    yield ChatStreamEvent(event="block", data=block)
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning("Failed to parse %s args: %s", tc_data["name"], e)
                    yield ChatStreamEvent(event="block", data={
                        "id": str(uuid4()),
                        "type": "error",
                        "payload": {"message": str(e), "raw": tc_data["arguments"][:200]},
                    })

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
