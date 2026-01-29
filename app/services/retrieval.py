"""Retrieval service for RAG."""

from dataclasses import dataclass
from uuid import UUID

from app.core.vector_store import vector_store
from app.services.embedding import embedding_service


@dataclass
class RetrievedChunk:
    """A chunk retrieved from vector search."""

    chunk_id: str
    document_id: str
    document_filename: str
    content: str
    page_number: int | None
    section_title: str | None
    score: float


class RetrievalService:
    """Service for retrieving relevant chunks."""

    def __init__(self, top_k: int = 20, score_threshold: float = 0.3):
        self.top_k = top_k
        self.score_threshold = score_threshold

    async def retrieve(
        self,
        query: str,
        tenant_id: UUID,
        collection_ids: list[UUID] | None = None,
        top_k: int | None = None,
    ) -> list[RetrievedChunk]:
        """
        Retrieve relevant chunks for a query.
        
        Args:
            query: User query
            tenant_id: Tenant ID for filtering
            collection_ids: Optional list of collection IDs to search
            top_k: Override default top_k
        
        Returns:
            List of retrieved chunks sorted by relevance
        """
        # Generate query embedding
        query_vector = await embedding_service.embed_query(query)
        
        # Search vector store
        results = await vector_store.search(
            query_vector=query_vector,
            tenant_id=tenant_id,
            collection_ids=collection_ids,
            limit=top_k or self.top_k,
            score_threshold=self.score_threshold,
        )
        
        # Convert to RetrievedChunk
        chunks = []
        for result in results:
            payload = result["payload"]
            chunks.append(RetrievedChunk(
                chunk_id=result["id"],
                document_id=payload.get("document_id", ""),
                document_filename=payload.get("document_filename", ""),
                content=payload.get("content", ""),
                page_number=payload.get("page_number"),
                section_title=payload.get("section_title"),
                score=result["score"],
            ))
        
        return chunks

    def build_context(
        self,
        chunks: list[RetrievedChunk],
        max_tokens: int = 4000,
    ) -> str:
        """
        Build context string from retrieved chunks.
        
        Args:
            chunks: Retrieved chunks
            max_tokens: Maximum tokens for context (rough estimate)
        
        Returns:
            Formatted context string
        """
        if not chunks:
            return ""
        
        context_parts = []
        estimated_tokens = 0
        
        for i, chunk in enumerate(chunks):
            # Format chunk with source info
            source_info = f"[Source: {chunk.document_filename}"
            if chunk.page_number:
                source_info += f", Page {chunk.page_number}"
            source_info += "]"
            
            chunk_text = f"{source_info}\n{chunk.content}"
            
            # Rough token estimate (4 chars per token)
            chunk_tokens = len(chunk_text) // 4
            
            if estimated_tokens + chunk_tokens > max_tokens:
                break
            
            context_parts.append(chunk_text)
            estimated_tokens += chunk_tokens
        
        return "\n\n---\n\n".join(context_parts)


# Singleton instance
retrieval_service = RetrievalService()
