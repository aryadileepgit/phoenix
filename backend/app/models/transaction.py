import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, Integer, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id"),
        nullable=False,
    )

    step: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    transaction_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    amount: Mapped[float] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )

    sender: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    sender_balance_before: Mapped[float] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )

    sender_balance_after: Mapped[float] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )

    receiver: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    receiver_balance_before: Mapped[float] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )

    receiver_balance_after: Mapped[float] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )

    actual_label: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    predicted_label: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )

    fraud_probability: Mapped[float] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )