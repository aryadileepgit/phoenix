import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Numeric, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class SchemaMapping(Base):
    __tablename__ = "schema_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    incoming_field: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    canonical_field: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    mapping_method: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    confidence_score: Mapped[float] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )

    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    source_schema: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
