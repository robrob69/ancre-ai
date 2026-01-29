"""OpenAI embedding service with caching."""

import hashlib
from typing import Sequence

from openai import AsyncOpenAI

from app.config import get_settings

settings = get_settings()


class EmbeddingService:
    """Service for generating embeddings using OpenAI."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions
        self._cache: dict[str, list[float]] = {}  # In-memory cache, replace with Redis in prod

    def _cache_key(self, text: str) -> str:
        """Generate cache key for text."""
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        return f"{self.model}:{text_hash}"

    async def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        cache_key = self._cache_key(text)
        if cache_key in self._cache:
            return self._cache[cache_key]

        response = await self.client.embeddings.create(
            input=text,
            model=self.model,
            dimensions=self.dimensions,
        )
        
        embedding = response.data[0].embedding
        self._cache[cache_key] = embedding
        return embedding

    async def embed_texts(
        self,
        texts: Sequence[str],
        batch_size: int = 100,
    ) -> tuple[list[list[float]], int]:
        """
        Generate embeddings for multiple texts.
        
        Returns:
            Tuple of (embeddings, total_tokens_used)
        """
        embeddings: list[list[float]] = []
        total_tokens = 0
        
        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            # Check cache first
            batch_embeddings = []
            texts_to_embed = []
            indices_to_embed = []
            
            for j, text in enumerate(batch):
                cache_key = self._cache_key(text)
                if cache_key in self._cache:
                    batch_embeddings.append((j, self._cache[cache_key]))
                else:
                    texts_to_embed.append(text)
                    indices_to_embed.append(j)
            
            # Embed non-cached texts
            if texts_to_embed:
                response = await self.client.embeddings.create(
                    input=texts_to_embed,
                    model=self.model,
                    dimensions=self.dimensions,
                )
                
                total_tokens += response.usage.total_tokens
                
                for idx, data in zip(indices_to_embed, response.data):
                    embedding = data.embedding
                    cache_key = self._cache_key(texts_to_embed[indices_to_embed.index(idx)])
                    self._cache[cache_key] = embedding
                    batch_embeddings.append((idx, embedding))
            
            # Sort by original index and extract embeddings
            batch_embeddings.sort(key=lambda x: x[0])
            embeddings.extend([emb for _, emb in batch_embeddings])
        
        return embeddings, total_tokens

    async def embed_query(self, query: str) -> list[float]:
        """Generate embedding for a search query."""
        # Queries don't need caching as they're typically unique
        response = await self.client.embeddings.create(
            input=query,
            model=self.model,
            dimensions=self.dimensions,
        )
        return response.data[0].embedding


# Singleton instance
embedding_service = EmbeddingService()
