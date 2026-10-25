"""
Adaptive retraining decisions.

The Q-learning agent is real (qlearning_service) but has never
acted: qlearning_states, drift_events and retraining_history are
empty. This router exposes the agent honestly:

- GET /adaptive/state: constants, latest drift event, latest
  Q-table rows, latest decision (if any), model evaluation from
  the latest ModelReport, and the retraining history table
  (empty until a real retraining run is recorded).
- POST /adaptive/decide: runs the agent against the latest drift
  event and returns its selected action. It does NOT retrain any
  model; actual training stays in the dataset pipeline.

No reinforcement-learning outcome is ever fabricated.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.drift_event import DriftEvent
from app.models.model_report import ModelReport
from app.models.transaction import Transaction
from app.models.qlearning_state import QLearningState
from app.models.retraining_history import RetrainingHistory
from app.services import qlearning_service
from app.services.qlearning_service import (
    ALPHA,
    EPSILON,
    GAMMA,
    get_q_learning_action,
)
from app.services.retraining_worker import (
    get_active_job,
    list_recent_jobs,
)


router = APIRouter(
    prefix="/adaptive",
    tags=["Adaptive Retraining"],
)


class DecideRequest(BaseModel):
    drift_event_id: str | None = None


@router.get("/state")
def get_state(db: Session = Depends(get_db)):
    try:
        latest_event = (
            db.query(DriftEvent)
            .order_by(desc(DriftEvent.detected_at))
            .first()
        )
    except Exception:
        latest_event = None

    try:
        q_rows = (
            db.query(QLearningState)
            .order_by(desc(QLearningState.created_at))
            .limit(50)
            .all()
        )
    except Exception:
        q_rows = []

    last_decision = q_rows[0] if q_rows else None

    try:
        history = (
            db.query(RetrainingHistory)
            .order_by(desc(RetrainingHistory.completed_at))
            .limit(20)
            .all()
        )
    except Exception:
        history = []

    try:
        model_report = (
            db.query(ModelReport)
            .order_by(desc(ModelReport.created_at))
            .first()
        )
    except Exception:
        model_report = None

    try:
        worker_job = get_active_job(db)
    except Exception:
        worker_job = None

    try:
        recent_jobs = list_recent_jobs(db)
    except Exception:
        recent_jobs = []

    try:
        label_stats = _label_stats(db)
    except Exception:
        label_stats = {
            "labeled_total": 0,
            "confirmed_fraud": 0,
            "confirmed_legitimate": 0,
            "min_required": 50,
            "eligible": False,
        }

    return {
        "agent": {
            "alpha": ALPHA,
            "gamma": GAMMA,
            "epsilon": EPSILON,
            "actions": list(qlearning_service.ACTIONS),
        },
        "latest_drift_event": (
            {
                "id": str(latest_event.id),
                "ks_score": float(latest_event.ks_score),
                "threshold": float(latest_event.threshold),
                "severity": latest_event.severity,
                "drift_detected": bool(
                    latest_event.drift_detected
                ),
                "detected_at": latest_event.detected_at,
            }
            if latest_event
            else None
        ),
        "last_decision": (
            {
                "state": last_decision.state_name,
                "action": last_decision.action_taken,
                "reward": float(last_decision.reward or 0.0),
                "q_value": float(last_decision.q_value or 0.0),
                "recorded_at": last_decision.created_at,
            }
            if last_decision
            else None
        ),
        "q_table": [
            {
                "state": row.state_name,
                "action": row.action_taken,
                "reward": float(row.reward or 0.0),
                "q_value": float(row.q_value or 0.0),
                "recorded_at": row.created_at,
            }
            for row in q_rows
        ],
        "retraining_history": [
            {
                "id": str(row.id),
                "action": row.action_taken,
                "reward": float(row.reward or 0.0),
                "training_duration_seconds": (
                    row.training_duration
                ),
                "completed_at": row.completed_at,
            }
            for row in history
        ],
        "model_evaluation": (
            {
                "accuracy": float(model_report.accuracy),
                "precision": float(model_report.precision),
                "recall": float(model_report.recall),
                "f1_score": float(model_report.f1_score),
                "roc_auc": float(model_report.roc_auc),
            }
            if model_report
            else None
        ),
        "worker": worker_job,
        "recent_jobs": recent_jobs,
        "label_stats": label_stats,
    }


def _label_stats(db: Session):
    """
    Analyst ground-truth inventory for RETRAIN_RECENT
    eligibility. Counts distinct labeled transactions only;
    unlabeled rows are never treated as ground truth.
    """

    from app.services.retraining_worker import MIN_LABELED_RECENT

    labeled_total = (
        db.query(Transaction)
        .filter(Transaction.actual_label != None)  # noqa: E711
        .count()
    )
    confirmed_fraud = (
        db.query(Transaction)
        .filter(Transaction.actual_label == True)  # noqa: E712
        .count()
    )
    confirmed_legitimate = (
        db.query(Transaction)
        .filter(Transaction.actual_label == False)  # noqa: E712
        .count()
    )

    return {
        "labeled_total": labeled_total,
        "confirmed_fraud": confirmed_fraud,
        "confirmed_legitimate": confirmed_legitimate,
        "min_required": MIN_LABELED_RECENT,
        "eligible": labeled_total >= MIN_LABELED_RECENT,
    }


@router.post("/decide")
def decide(payload: DecideRequest, db: Session = Depends(get_db)):
    if payload.drift_event_id:
        event = (
            db.query(DriftEvent)
            .filter(DriftEvent.id == payload.drift_event_id)
            .first()
        )
        if event is None:
            raise HTTPException(
                status_code=404,
                detail="Drift event not found.",
            )
        drift_event_id = str(event.id)
    else:
        latest = (
            db.query(DriftEvent)
            .order_by(desc(DriftEvent.detected_at))
            .first()
        )
        if latest is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No drift event exists yet. "
                    "Run drift detection first."
                ),
            )
        drift_event_id = str(latest.id)

    result = get_q_learning_action(drift_event_id, db)

    return {
        "message": (
            "Q-learning agent selected an action. "
            "No model was retrained by this call."
        ),
        "drift_event_id": drift_event_id,
        "state": result["state_name"],
        "action": result["action"],
        "q_values": result["q_values"],
        "epsilon": result["epsilon"],
    }
