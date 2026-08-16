import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class DatasetValidation(Base):
    __tablename__ = "dataset_validation"

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

    total_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    total_columns: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    missing_values: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    duplicate_rows: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    validation_status: Mapped[str] = mapped_column(
        String(20),
        default="Passed",
    )

    validated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )