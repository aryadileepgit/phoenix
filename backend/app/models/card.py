import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Boolean, UUID as SQLUUID, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    card_id: Mapped[str] = mapped_column(
        String,
        unique=True,
        nullable=False,
    )

    card_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    card_last_four: Mapped[str] = mapped_column(
        String(4),
        nullable=False,
    )

    issuing_bank: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
