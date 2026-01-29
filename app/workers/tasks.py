"""Arq task definitions for document processing."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from arq import ArqRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import get_settings
from app.core.chunking import chunk_document
from app.core.parsing import parse_document
from app.core.vector_store import vector_store
from app.models.chunk import Chunk
from app.models.collection import Collection
from app.models.document import Document, DocumentStatus
from app.services.embedding import embedding_service
from app.services.storage import storage_service
from app.workers.settings import redis_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# Create engine for worker (separate from web app)
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """Get database session for worker."""
    return async_session_maker()


async def process_document(ctx: dict, document_id: str) -> dict:
    """
    Process a document: download, parse, chunk, embed, index.
    
    Args:
        ctx: Arq context
        document_id: UUID of the document to process
    
    Returns:
        Dict with processing results
    """
    doc_uuid = UUID(document_id)
    db = await get_db()
    
    try:
        # Get document
        result = await db.execute(
            select(Document).where(Document.id == doc_uuid)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            logger.error(f"Document {document_id} not found")
            return {"error": "Document not found"}
        
        # Update status to processing
        document.status = DocumentStatus.PROCESSING.value
        await db.commit()
        
        # Get collection for tenant_id
        result = await db.execute(
            select(Collection).where(Collection.id == document.collection_id)
        )
        collection = result.scalar_one()
        tenant_id = collection.tenant_id
        
        logger.info(f"Processing document {document_id}: {document.filename}")
        
        # 1. Download from S3
        content = await storage_service.download_file(document.s3_key)
        
        # 2. Parse document
        parsed = parse_document(content, document.filename, document.content_type)
        document.page_count = parsed.total_pages
        
        # 3. Chunk document
        chunks = chunk_document(parsed)
        document.chunk_count = len(chunks)
        
        if not chunks:
            document.status = DocumentStatus.READY.value
            document.processed_at = datetime.now(timezone.utc)
            await db.commit()
            return {"message": "No content to index", "chunks": 0}
        
        # 4. Generate embeddings
        chunk_texts = [c.content for c in chunks]
        embeddings, tokens_used = await embedding_service.embed_texts(chunk_texts)
        document.tokens_used = tokens_used
        
        # 5. Prepare chunks for DB and vector store
        db_chunks = []
        vector_chunks = []
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            # Create DB chunk
            db_chunk = Chunk(
                document_id=doc_uuid,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                content_hash=chunk.content_hash,
                token_count=chunk.token_count,
                page_number=chunk.page_number,
                start_offset=chunk.start_offset,
                end_offset=chunk.end_offset,
                section_title=chunk.section_title,
            )
            db.add(db_chunk)
            db_chunks.append(db_chunk)
            
            # Prepare vector store entry
            vector_chunks.append({
                "id": str(db_chunk.id),
                "vector": embedding,
                "payload": {
                    "tenant_id": str(tenant_id),
                    "collection_id": str(document.collection_id),
                    "document_id": str(doc_uuid),
                    "document_filename": document.filename,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "page_number": chunk.page_number,
                    "section_title": chunk.section_title,
                },
            })
        
        # Save chunks to DB
        await db.flush()
        
        # Update qdrant_id after flush (to get generated UUIDs)
        for db_chunk, vec_chunk in zip(db_chunks, vector_chunks):
            db_chunk.qdrant_id = vec_chunk["id"]
            vec_chunk["id"] = str(db_chunk.id)
        
        # 6. Ensure collection exists and index vectors
        await vector_store.ensure_collection()
        await vector_store.upsert_chunks(vector_chunks)
        
        # 7. Update document status
        document.status = DocumentStatus.READY.value
        document.processed_at = datetime.now(timezone.utc)
        document.error_message = None
        await db.commit()
        
        logger.info(
            f"Document {document_id} processed: "
            f"{document.page_count} pages, {len(chunks)} chunks, {tokens_used} tokens"
        )
        
        return {
            "document_id": document_id,
            "pages": document.page_count,
            "chunks": len(chunks),
            "tokens_used": tokens_used,
        }
        
    except Exception as e:
        logger.exception(f"Error processing document {document_id}")
        
        # Update document with error
        document.status = DocumentStatus.FAILED.value
        document.error_message = str(e)[:2000]
        await db.commit()
        
        return {"error": str(e)}
    
    finally:
        await db.close()


async def startup(ctx: dict) -> None:
    """Worker startup hook."""
    logger.info("Worker starting up...")
    await vector_store.ensure_collection()


async def shutdown(ctx: dict) -> None:
    """Worker shutdown hook."""
    logger.info("Worker shutting down...")
    await engine.dispose()


class WorkerSettings:
    """Arq worker settings."""
    
    functions = [process_document]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = redis_settings
    max_jobs = 10
    job_timeout = 600  # 10 minutes max per job
    keep_result = 3600  # Keep results for 1 hour
