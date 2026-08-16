import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class ModelReport(Base):
    __tablename__ = "model_reports"

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

    model_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    accuracy: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    precision: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    recall: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    f1_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    roc_auc: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    train_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    test_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    model_path: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    is_best_model: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="Completed",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )