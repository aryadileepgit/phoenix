import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class DatasetCleaning(Base):
    __tablename__ = "dataset_cleaning"

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

    rows_before: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    rows_after: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    duplicates_removed: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    missing_values_fixed: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    cleaned_file: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="Completed",
    )

    cleaned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )