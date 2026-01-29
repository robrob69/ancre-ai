"""Chat endpoints with SSE streaming."""

import json
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models.assistant import Assistant
from app.models.message import Message, MessageRole
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat import chat_service
from app.services.usage import usage_service
from app.services.quota import quota_service

router = APIRouter()


async def format_sse(event: str, data: str) -> str:
    """Format SSE message."""
    return f"event: {event}\ndata: {data}\n\n"


@router.post("/{assistant_id}", response_model=ChatResponse)
async def chat(
    assistant_id: UUID,
    request: ChatRequest,
    user: CurrentUser,
    db: DbSession,
) -> ChatResponse:
    """Chat with an assistant (non-streaming)."""
    tenant_id = user.tenant_id
    
    # Get assistant with collections
    result = await db.execute(
        select(Assistant)
        .options(selectinload(Assistant.collections))
        .where(Assistant.id == assistant_id)
        .where(Assistant.tenant_id == tenant_id)
    )
    assistant = result.scalar_one_or_none()
    
    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found",
        )
    
    if not assistant.collections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assistant has no collections assigned",
        )
    
    collection_ids = [c.id for c in assistant.collections]
    conversation_id = request.conversation_id or uuid4()
    
    # Check chat quota (free tier limit)
    allowed, error = await quota_service.check_chat_allowed(db, user)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error,
        )
    
    # Get conversation history if requested
    history = []
    if request.include_history and request.conversation_id:
        result = await db.execute(
            select(Message)
            .where(Message.assistant_id == assistant_id)
            .where(Message.conversation_id == request.conversation_id)
            .order_by(Message.created_at.desc())
            .limit(request.max_history_messages)
        )
        messages = list(reversed(result.scalars().all()))
        history = [{"role": m.role, "content": m.content} for m in messages]
    
    # Call chat service
    response_text, citations, tokens_input, tokens_output = await chat_service.chat(
        message=request.message,
        tenant_id=tenant_id,
        collection_ids=collection_ids,
        system_prompt=assistant.system_prompt,
        conversation_history=history,
    )
    
    # Save user message
    user_message = Message(
        assistant_id=assistant_id,
        conversation_id=conversation_id,
        role=MessageRole.USER.value,
        content=request.message,
        tokens_input=tokens_input,
    )
    db.add(user_message)
    
    # Save assistant message
    assistant_message = Message(
        assistant_id=assistant_id,
        conversation_id=conversation_id,
        role=MessageRole.ASSISTANT.value,
        content=response_text,
        citations=[c.model_dump() for c in citations],
        tokens_output=tokens_output,
    )
    db.add(assistant_message)
    
    # Record usage (both quota tracking and usage tracking)
    await quota_service.record_chat_request(db, user.id)
    await usage_service.record_chat(db, tenant_id, tokens_input, tokens_output)
    
    await db.commit()
    
    return ChatResponse(
        message=response_text,
        conversation_id=conversation_id,
        citations=citations,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
    )


@router.post("/{assistant_id}/stream")
async def chat_stream(
    assistant_id: UUID,
    request: ChatRequest,
    user: CurrentUser,
    db: DbSession,
) -> StreamingResponse:
    """Chat with an assistant (SSE streaming)."""
    tenant_id = user.tenant_id
    user_id = user.id
    
    # Get assistant with collections
    result = await db.execute(
        select(Assistant)
        .options(selectinload(Assistant.collections))
        .where(Assistant.id == assistant_id)
        .where(Assistant.tenant_id == tenant_id)
    )
    assistant = result.scalar_one_or_none()
    
    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found",
        )
    
    if not assistant.collections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assistant has no collections assigned",
        )
    
    collection_ids = [c.id for c in assistant.collections]
    conversation_id = request.conversation_id or uuid4()
    
    # Check chat quota (free tier limit)
    allowed, error = await quota_service.check_chat_allowed(db, user)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error,
        )
    
    # Record quota usage immediately (before streaming)
    await quota_service.record_chat_request(db, user_id)
    
    # Get conversation history if requested
    history = []
    if request.include_history and request.conversation_id:
        result = await db.execute(
            select(Message)
            .where(Message.assistant_id == assistant_id)
            .where(Message.conversation_id == request.conversation_id)
            .order_by(Message.created_at.desc())
            .limit(request.max_history_messages)
        )
        messages = list(reversed(result.scalars().all()))
        history = [{"role": m.role, "content": m.content} for m in messages]

    async def event_generator():
        """Generate SSE events."""
        full_response = ""
        citations = []
        tokens_input = 0
        tokens_output = 0
        
        # Send conversation ID first
        yield await format_sse("conversation_id", str(conversation_id))
        
        async for event in chat_service.chat_stream(
            message=request.message,
            tenant_id=tenant_id,
            collection_ids=collection_ids,
            system_prompt=assistant.system_prompt,
            conversation_history=history,
        ):
            if event.event == "token":
                full_response += event.data
                yield await format_sse("token", event.data)
            elif event.event == "citations":
                citations = event.data
                yield await format_sse("citations", json.dumps(event.data))
            elif event.event == "done":
                tokens_input = event.data.get("tokens_input", 0)
                tokens_output = event.data.get("tokens_output", 0)
                yield await format_sse("done", json.dumps(event.data))
            elif event.event == "error":
                yield await format_sse("error", event.data)
            else:
                yield await format_sse(event.event, json.dumps(event.data) if isinstance(event.data, dict) else str(event.data))
        
        # Save messages after streaming completes
        # Note: Using a new session since the streaming may have closed the original
        from app.database import async_session_maker
        async with async_session_maker() as save_db:
            user_message = Message(
                assistant_id=assistant_id,
                conversation_id=conversation_id,
                role=MessageRole.USER.value,
                content=request.message,
                tokens_input=tokens_input,
            )
            save_db.add(user_message)
            
            assistant_message = Message(
                assistant_id=assistant_id,
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT.value,
                content=full_response,
                citations=citations,
                tokens_output=tokens_output,
            )
            save_db.add(assistant_message)
            await save_db.commit()
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{assistant_id}/conversations")
async def list_conversations(
    assistant_id: UUID,
    user: CurrentUser,
    db: DbSession,
) -> list[dict]:
    """List all conversations for an assistant."""
    from sqlalchemy import func, distinct
    
    # Verify assistant belongs to user's tenant
    result = await db.execute(
        select(Assistant)
        .where(Assistant.id == assistant_id)
        .where(Assistant.tenant_id == user.tenant_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found",
        )
    
    # Get distinct conversation IDs with first message and timestamp
    # Using a subquery to get conversation metadata
    result = await db.execute(
        select(
            Message.conversation_id,
            func.min(Message.created_at).label("started_at"),
            func.max(Message.created_at).label("last_message_at"),
            func.count(Message.id).label("message_count"),
        )
        .where(Message.assistant_id == assistant_id)
        .group_by(Message.conversation_id)
        .order_by(func.max(Message.created_at).desc())
        .limit(50)
    )
    conversations = result.all()
    
    # Get first user message for each conversation to use as title
    conversation_list = []
    for conv in conversations:
        # Get first user message as title
        first_msg_result = await db.execute(
            select(Message.content)
            .where(Message.conversation_id == conv.conversation_id)
            .where(Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        first_msg = first_msg_result.scalar_one_or_none()
        title = first_msg[:50] + "..." if first_msg and len(first_msg) > 50 else first_msg or "Conversation"
        
        conversation_list.append({
            "id": str(conv.conversation_id),
            "title": title,
            "started_at": conv.started_at.isoformat(),
            "last_message_at": conv.last_message_at.isoformat(),
            "message_count": conv.message_count,
        })
    
    return conversation_list


@router.get("/{assistant_id}/conversations/{conversation_id}")
async def get_conversation(
    assistant_id: UUID,
    conversation_id: UUID,
    user: CurrentUser,
    db: DbSession,
) -> list[dict]:
    """Get conversation history."""
    # Verify assistant belongs to user's tenant
    result = await db.execute(
        select(Assistant)
        .where(Assistant.id == assistant_id)
        .where(Assistant.tenant_id == user.tenant_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found",
        )
    
    result = await db.execute(
        select(Message)
        .where(Message.assistant_id == assistant_id)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "citations": m.citations,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
