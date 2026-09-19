import uuid
from datetime import datetime

from sqlalchemy import DateTime, Numeric, String, Boolean, JSON
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

    transaction_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )

    account_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    amount: Mapped[float] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )

    transaction_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    product_code: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    card_information: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    device_information: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    additional_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    fraud_probability: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    predicted_label: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    risk_level: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    decision: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    actual_label: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )