import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Numeric, Integer, UUID as SQLUUID, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class RiskProfile(Base):
    __tablename__ = "risk_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id"),
        nullable=False,
    )

    risk_score: Mapped[float] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )

    risk_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    total_transactions: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    fraud_transactions: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    avg_amount: Mapped[float] = mapped_column(
        Numeric(15, 2),
        nullable=False,
    )

    unusual_devices: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    unusual_locations: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
