"""
RL Evaluation models for virtual batch benchmarking.

Stores per-batch metrics, agent actions, rewards, and the
static-vs-adaptive comparison needed for the evaluation dashboard.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class RLAction(str, PyEnum):
    IGNORE = "ignore"
    RETRAIN_NEW = "retrain_new"
    RETRAIN_MIXED = "retrain_mixed"


class RLEvaluationRun(Base):
    """A single evaluation run (e.g., 25 virtual batches)."""

    __tablename__ = "rl_evaluation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_batches: Mapped[int] = mapped_column(Integer, nullable=False)
    batch_size: Mapped[int] = mapped_column(Integer, nullable=False)
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False
    )
    baseline_model_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ml_models.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    batches: Mapped[list["RLEvaluationBatch"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class RLEvaluationBatch(Base):
    """Per-batch metrics for one evaluation run."""

    __tablename__ = "rl_evaluation_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rl_evaluation_runs.id"), nullable=False
    )
    batch_number: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    record_count: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_healed: Mapped[bool] = mapped_column(default=False)
    drift_detected: Mapped[bool] = mapped_column(default=False)
    drift_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    rl_action: Mapped[RLAction | None] = mapped_column(
        Enum(RLAction), nullable=True
    )
    f1_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    f1_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    precision: Mapped[float | None] = mapped_column(Float, nullable=True)
    recall: Mapped[float | None] = mapped_column(Float, nullable=True)
    reward: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ml_models.id"), nullable=True
    )
    processing_time_ms: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    run: Mapped["RLEvaluationRun"] = relationship(back_populates="batches")


class RLBaselineComparison(Base):
    """Static baseline vs adaptive F1 per batch for the comparison chart."""

    __tablename__ = "rl_baseline_comparisons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rl_evaluation_runs.id"), nullable=False
    )
    batch_number: Mapped[int] = mapped_column(Integer, nullable=False)
    adaptive_f1: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_f1: Mapped[float | None] = mapped_column(Float, nullable=True)
    adaptive_precision: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_precision: Mapped[float | None] = mapped_column(Float, nullable=True)
    adaptive_recall: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_recall: Mapped[float | None] = mapped_column(Float, nullable=True)