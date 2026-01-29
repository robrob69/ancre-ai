"""Assistant endpoints."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models.assistant import Assistant
from app.models.collection import Collection
from app.models.subscription import SubscriptionPlan
from app.schemas.assistant import (
    AssistantCreate,
    AssistantRead,
    AssistantReadWithCollections,
    AssistantUpdate,
)
from app.services.quota import quota_service

router = APIRouter()

# Plan limits for assistants
ASSISTANT_LIMITS = {
    SubscriptionPlan.FREE.value: 3,
    SubscriptionPlan.PRO.value: 10,
}


@router.get("", response_model=list[AssistantReadWithCollections])
async def list_assistants(
    user: CurrentUser,
    db: DbSession,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """List assistants for tenant with their collections."""
    result = await db.execute(
        select(Assistant)
        .options(selectinload(Assistant.collections))
        .where(Assistant.tenant_id == user.tenant_id)
        .order_by(Assistant.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    
    assistants = result.scalars().all()
    return [
        {
            **AssistantRead.model_validate(a).model_dump(),
            "collection_ids": [c.id for c in a.collections],
        }
        for a in assistants
    ]


@router.get("/{assistant_id}", response_model=AssistantReadWithCollections)
async def get_assistant(
    assistant_id: UUID,
    user: CurrentUser,
    db: DbSession,
) -> dict:
    """Get a specific assistant with its collections."""
    result = await db.execute(
        select(Assistant)
        .options(selectinload(Assistant.collections))
        .where(Assistant.id == assistant_id)
        .where(Assistant.tenant_id == user.tenant_id)
    )
    assistant = result.scalar_one_or_none()
    
    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found",
        )
    
    return {
        **AssistantRead.model_validate(assistant).model_dump(),
        "collection_ids": [c.id for c in assistant.collections],
    }


@router.post("", response_model=AssistantReadWithCollections, status_code=status.HTTP_201_CREATED)
async def create_assistant(
    data: AssistantCreate,
    user: CurrentUser,
    db: DbSession,
) -> dict:
    """Create a new assistant."""
    tenant_id = user.tenant_id
    
    # Get subscription to determine limit
    subscription = await quota_service.get_subscription(db, user.id)
    plan = subscription.plan if subscription else SubscriptionPlan.FREE.value
    max_assistants = ASSISTANT_LIMITS.get(plan, 3)
    
    # Count existing assistants
    count_result = await db.execute(
        select(func.count(Assistant.id)).where(Assistant.tenant_id == tenant_id)
    )
    current_count = count_result.scalar() or 0
    
    if current_count >= max_assistants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Limite d'assistants atteinte ({current_count}/{max_assistants}). Passez en Pro pour en créer plus.",
        )
    
    assistant = Assistant(
        tenant_id=tenant_id,
        name=data.name,
        system_prompt=data.system_prompt,
        model=data.model,
        settings=data.settings,
    )
    
    # Add collections if specified
    if data.collection_ids:
        result = await db.execute(
            select(Collection)
            .where(Collection.id.in_(data.collection_ids))
            .where(Collection.tenant_id == tenant_id)
        )
        collections = list(result.scalars().all())
        assistant.collections = collections
    
    db.add(assistant)
    await db.commit()
    await db.refresh(assistant)
    
    # Reload with collections
    result = await db.execute(
        select(Assistant)
        .options(selectinload(Assistant.collections))
        .where(Assistant.id == assistant.id)
    )
    assistant = result.scalar_one()
    
    return {
        **AssistantRead.model_validate(assistant).model_dump(),
        "collection_ids": [c.id for c in assistant.collections],
    }


@router.patch("/{assistant_id}", response_model=AssistantReadWithCollections)
async def update_assistant(
    assistant_id: UUID,
    data: AssistantUpdate,
    user: CurrentUser,
    db: DbSession,
) -> dict:
    """Update an assistant."""
    tenant_id = user.tenant_id
    
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
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Handle collections separately
    collection_ids = update_data.pop("collection_ids", None)
    if collection_ids is not None:
        result = await db.execute(
            select(Collection)
            .where(Collection.id.in_(collection_ids))
            .where(Collection.tenant_id == tenant_id)
        )
        collections = list(result.scalars().all())
        assistant.collections = collections
    
    for key, value in update_data.items():
        setattr(assistant, key, value)
    
    await db.commit()
    await db.refresh(assistant)
    
    return {
        **AssistantRead.model_validate(assistant).model_dump(),
        "collection_ids": [c.id for c in assistant.collections],
    }


@router.delete("/{assistant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assistant(
    assistant_id: UUID,
    user: CurrentUser,
    db: DbSession,
) -> None:
    """Delete an assistant."""
    result = await db.execute(
        select(Assistant)
        .where(Assistant.id == assistant_id)
        .where(Assistant.tenant_id == user.tenant_id)
    )
    assistant = result.scalar_one_or_none()
    
    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found",
        )
    
    await db.delete(assistant)
    await db.commit()
