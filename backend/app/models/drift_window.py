import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Numeric, Boolean, UUID as SQLUUID, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class DriftWindow(Base):
    __tablename__ = "drift_windows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ml_models.id"),
        nullable=False,
    )

    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    window_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    ks_score: Mapped[float] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )

    fraud_rate_reference: Mapped[float] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )

    fraud_rate_current: Mapped[float] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )

    drift_detected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
