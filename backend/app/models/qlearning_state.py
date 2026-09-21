import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Numeric, Text, UUID as SQLUUID
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class QLearningState(Base):
    __tablename__ = "qlearning_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    state_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    action_taken: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    reward: Mapped[float] = mapped_column(
        Numeric(10, 6),
        nullable=False,
    )

    q_value: Mapped[float] = mapped_column(
        Numeric(10, 6),
        nullable=False,
    )

    next_state: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
