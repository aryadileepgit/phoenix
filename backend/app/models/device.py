import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    device_id: Mapped[str] = mapped_column(
        String,
        unique=True,
        nullable=False,
    )

    device_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    device_fingerprint: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    os_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    app_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    is_trusted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
    )
