import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class MLModel(Base):
    __tablename__ = "ml_models"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    model_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    algorithm: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    accuracy: Mapped[float] = mapped_column(
        Numeric(5, 2),
    )

    precision: Mapped[float] = mapped_column(
        Numeric(5, 2),
    )

    recall: Mapped[float] = mapped_column(
        Numeric(5, 2),
    )

    f1_score: Mapped[float] = mapped_column(
        Numeric(5, 2),
    )

    roc_auc: Mapped[float] = mapped_column(
        Numeric(5, 2),
    )

    model_path: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    trained_on_dataset: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id"),
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="Active",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )