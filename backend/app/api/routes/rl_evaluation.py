"""
RL Evaluation API — virtual batch benchmarking for the adaptive agent.

Endpoints:
  POST   /rl-evaluation/runs              Create & start a new evaluation run
  GET    /rl-evaluation/runs              List all runs
  GET    /rl-evaluation/runs/{id}         Get run details
  GET    /rl-evaluation/runs/{id}/batches Get per-batch metrics
  GET    /rl-evaluation/runs/{id}/chart   Get chart data (reward, actions, baseline vs adaptive)
  GET    /rl-evaluation/runs/{id}/summary Get summary statistics
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.rl_evaluation import (
    RLAction,
    RLEvaluationBatch,
    RLEvaluationRun,
    RLBaselineComparison,
)
from app.services.rl_virtual_batch_simulator import BatchConfig, VirtualBatchSimulator

router = APIRouter(
    prefix="/rl-evaluation",
    tags=["RL Evaluation"],
)


@router.post("/runs")
def create_evaluation_run(
    name: str,
    dataset_id: str,
    total_batches: int = 25,
    batch_size: int = 10000,
    baseline_model_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Create and start a new RL evaluation run.

    Runs asynchronously in the background. Poll GET /runs/{id} for status.
    """
    # Validate dataset exists
    from app.models.dataset import Dataset

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    baseline_uuid = uuid.UUID(baseline_model_id) if baseline_model_id else None

    config = BatchConfig(
        batch_size=batch_size,
        total_batches=total_batches,
    )

    try:
        simulator = VirtualBatchSimulator(dataset_id, config, db)
        run = simulator.run_evaluation(name, baseline_model_id=baseline_uuid)
        return {
            "run_id": str(run.id),
            "name": run.name,
            "status": run.status,
            "total_batches": run.total_batches,
            "message": "Evaluation started. Poll GET /runs/{id} for progress.",
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to start evaluation: {str(e)}")


@router.get("/runs")
def list_evaluation_runs(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List all evaluation runs, newest first."""
    runs = (
        db.query(RLEvaluationRun)
        .order_by(desc(RLEvaluationRun.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "status": r.status,
            "total_batches": r.total_batches,
            "batch_size": r.batch_size,
            "dataset_id": str(r.dataset_id),
            "created_at": r.created_at,
            "started_at": r.started_at,
            "completed_at": r.completed_at,
        }
        for r in runs
    ]


@router.get("/runs/{run_id}")
def get_evaluation_run(
    run_id: str,
    db: Session = Depends(get_db),
):
    """Get evaluation run details."""
    run = db.query(RLEvaluationRun).get(run_id)
    if not run:
        raise HTTPException(404, "Evaluation run not found")

    return {
        "id": str(run.id),
        "name": run.name,
        "description": run.description,
        "status": run.status,
        "total_batches": run.total_batches,
        "batch_size": run.batch_size,
        "dataset_id": str(run.dataset_id),
        "baseline_model_id": str(run.baseline_model_id) if run.baseline_model_id else None,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "created_at": run.created_at,
    }


@router.get("/runs/{run_id}/batches")
def get_evaluation_batches(
    run_id: str,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Get per-batch metrics for an evaluation run."""
    batches = (
        db.query(RLEvaluationBatch)
        .filter(RLEvaluationBatch.run_id == run_id)
        .order_by(RLEvaluationBatch.batch_number)
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        {
            "batch_number": b.batch_number,
            "timestamp": b.timestamp,
            "record_count": b.record_count,
            "schema_healed": b.schema_healed,
            "drift_detected": b.drift_detected,
            "drift_score": b.drift_score,
            "rl_action": b.rl_action.value if b.rl_action else None,
            "f1_before": b.f1_before,
            "f1_after": b.f1_after,
            "precision": b.precision,
            "recall": b.recall,
            "reward": b.reward,
            "model_id": str(b.model_id) if b.model_id else None,
            "processing_time_ms": b.processing_time_ms,
        }
        for b in batches
    ]


@router.get("/runs/{run_id}/chart")
def get_evaluation_chart_data(
    run_id: str,
    db: Session = Depends(get_db),
):
    """
    Get all chart data for the evaluation dashboard.

    Returns:
    - reward_per_batch: [{batch, reward}]
    - action_distribution: {ignore, retrain_new, retrain_mixed}
    - baseline_vs_adaptive: [{batch, adaptive_f1, baseline_f1}]
    - per_batch_metrics: [{batch, f1_before, f1_after, precision, recall, action, drift}]
    """
    batches = (
        db.query(RLEvaluationBatch)
        .filter(RLEvaluationBatch.run_id == run_id)
        .order_by(RLEvaluationBatch.batch_number)
        .all()
    )

    if not batches:
        raise HTTPException(404, "No batch data for this run")

    comparisons = (
        db.query(RLBaselineComparison)
        .filter(RLBaselineComparison.run_id == run_id)
        .order_by(RLBaselineComparison.batch_number)
        .all()
    )

    # Action distribution
    action_counts = {"ignore": 0, "retrain_new": 0, "retrain_mixed": 0}
    for b in batches:
        if b.rl_action:
            action_counts[b.rl_action.value] += 1

    return {
        "reward_per_batch": [
            {"batch": b.batch_number, "reward": b.reward or 0} for b in batches
        ],
        "action_distribution": action_counts,
        "baseline_vs_adaptive": [
            {
                "batch": c.batch_number,
                "adaptive_f1": c.adaptive_f1,
                "baseline_f1": c.baseline_f1,
                "adaptive_precision": c.adaptive_precision,
                "baseline_precision": c.baseline_precision,
                "adaptive_recall": c.adaptive_recall,
                "baseline_recall": c.baseline_recall,
            }
            for c in comparisons
        ],
        "per_batch_metrics": [
            {
                "batch": b.batch_number,
                "f1_before": b.f1_before,
                "f1_after": b.f1_after,
                "precision": b.precision,
                "recall": b.recall,
                "action": b.rl_action.value if b.rl_action else None,
                "drift_detected": b.drift_detected,
                "drift_score": b.drift_score,
                "schema_healed": b.schema_healed,
                "reward": b.reward or 0,
            }
            for b in batches
        ],
    }


@router.get("/runs/{run_id}/summary")
def get_evaluation_summary(
    run_id: str,
    db: Session = Depends(get_db),
):
    """Get summary statistics for an evaluation run."""
    run = db.query(RLEvaluationRun).get(run_id)
    if not run:
        raise HTTPException(404, "Evaluation run not found")

    batches = (
        db.query(RLEvaluationBatch)
        .filter(RLEvaluationBatch.run_id == run_id)
        .all()
    )

    if not batches:
        return {
            "run_id": str(run.id),
            "name": run.name,
            "status": run.status,
            "total_batches": run.total_batches,
            "completed_batches": 0,
        }

    completed = [b for b in batches if b.f1_after is not None]
    rewards = [b.reward for b in completed if b.reward is not None]
    f1_afters = [b.f1_after for b in completed if b.f1_after is not None]
    f1_befores = [b.f1_before for b in completed if b.f1_before is not None]

    action_counts = {"ignore": 0, "retrain_new": 0, "retrain_mixed": 0}
    drift_count = 0
    schema_healed_count = 0

    for b in completed:
        if b.rl_action:
            action_counts[b.rl_action.value] += 1
        if b.drift_detected:
            drift_count += 1
        if b.schema_healed:
            schema_healed_count += 1

    return {
        "run_id": str(run.id),
        "name": run.name,
        "status": run.status,
        "total_batches": run.total_batches,
        "completed_batches": len(completed),
        "avg_reward": sum(rewards) / len(rewards) if rewards else 0,
        "total_reward": sum(rewards) if rewards else 0,
        "avg_f1_before": sum(f1_befores) / len(f1_befores) if f1_befores else 0,
        "avg_f1_after": sum(f1_afters) / len(f1_afters) if f1_afters else 0,
        "f1_improvement": (sum(f1_afters) - sum(f1_befores)) / len(f1_afters)
        if f1_afters
        else 0,
        "action_distribution": action_counts,
        "drift_batches": drift_count,
        "schema_healed_batches": schema_healed_count,
        "duration_seconds": (
            (run.completed_at - run.started_at).total_seconds()
            if run.completed_at and run.started_at
            else None
        ),
    }