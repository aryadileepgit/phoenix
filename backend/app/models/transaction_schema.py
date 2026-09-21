import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Boolean, Text, UUID as SQLUUID
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class TransactionSchema(Base):
    __tablename__ = "transaction_schemas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    schema_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    canonical_fields: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
