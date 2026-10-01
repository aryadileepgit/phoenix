import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class TransactionReview(Base):
    """
    Analyst ground-truth audit trail for scored transactions.

    Each row records one human verdict. Re-reviews are allowed
    (corrections stay auditable); the latest row per transaction
    is the effective verdict and is mirrored onto
    Transaction.actual_label for queries and display.

    The model's own outputs (predicted_label, fraud_probability,
    risk_level, decision) are NEVER modified by reviews.
    """

    __tablename__ = "transaction_reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id"),
        nullable=False,
        index=True,
    )

    actual_label: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )

    reviewer: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="analyst_ui",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
