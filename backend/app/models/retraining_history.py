import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class RetrainingHistory(Base):
    __tablename__ = "retraining_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    drift_event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drift_events.id"),
        nullable=False,
    )

    old_model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ml_models.id"),
        nullable=False,
    )

    new_model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ml_models.id"),
        nullable=False,
    )

    action_taken: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    reward: Mapped[float] = mapped_column(
        Numeric(8, 4),
        nullable=False,
    )

    training_duration: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )