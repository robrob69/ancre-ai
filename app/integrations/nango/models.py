"""SQLAlchemy model for Nango connection references.

We store a reference to each Nango connection in our DB to:
1. Associate connections with tenants (multi-tenant isolation)
2. Track which providers a tenant has connected
3. Store metadata (connection status, timestamps)

We do NOT store OAuth tokens. Nango manages those.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class NangoConnection(Base):
    """Reference to a Nango-managed OAuth connection."""

    __tablename__ = "nango_connections"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Provider key (e.g. hubspot, salesforce)"
    )
    nango_connection_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        comment="Connection ID used in Nango (typically tenant_id:provider)",
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending", comment="pending | connected | error"
    )
    metadata_json: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Optional JSON metadata"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
