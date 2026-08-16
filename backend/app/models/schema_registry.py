import uuid
from datetime import datetime

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class SchemaRegistry(Base):
    __tablename__ = "schema_registry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    incoming_column: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    standard_column: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    mapping_method: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    confidence: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )

    approval_status: Mapped[str] = mapped_column(
        String(30),
        default="Pending",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )