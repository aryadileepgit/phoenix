"""
Concept drift HTTP layer (thin).

All detection math lives in drift_detection_service, which
compares recent scored API transactions against the IEEE-CIS
training reference distribution. After persisting a run, this
router consults the retraining gate: Q-learning decides, and
only a RETRAIN_* decision starts a background worker.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import Integer, desc, func
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.drift_event import DriftEvent
from app.services import drift_detection_service as drift
from app.services.retraining_worker import maybe_trigger_from_event
from app.services.runtime_settings import get_drift_thresholds


router = APIRouter(
    prefix="/drift",
    tags=["Concept Drift"],
)


def _recent_events(db: Session, limit: int = 10):
    events = (
        db.query(DriftEvent)
        .order_by(desc(DriftEvent.detected_at))
        .limit(limit)
        .all()
    )

    out = []
    for event in events:
        severity = (event.severity or "LOW").capitalize()
        out.append(
            {
                "id": str(event.id),
                "ks_score": float(event.ks_score),
                "threshold": float(event.threshold),
                "severity": (
                    severity
                    if severity in ("Low", "Medium", "High")
                    else "Low"
                ),
                "drift_detected": bool(event.drift_detected),
                "timestamp": event.detected_at,
            }
        )
    return out


def _daily_rates(db: Session, limit: int = 30):
    from app.models.transaction import Transaction

    day = func.date_trunc("day", Transaction.created_at)
    rows = (
        db.query(
            day.label("day"),
            func.count(Transaction.id).label("total"),
            func.sum(
                func.cast(Transaction.predicted_label, Integer)
            ).label("fraud"),
        )
        .filter(Transaction.fraud_probability != None)  # noqa: E711
        .group_by(day)
        .order_by(day.asc())
        .limit(limit)
        .all()
    )

    return [
        {
            "date": row.day.isoformat() if row.day else None,
            "fraud_rate": round(
                int(row.fraud or 0) / int(row.total or 1), 6
            ),
            "total": int(row.total or 0),
        }
        for row in rows
    ]


@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    _, fraud_threshold = get_drift_thresholds()

    event = (
        db.query(DriftEvent)
        .order_by(desc(DriftEvent.detected_at))
        .first()
    )

    snapshot = drift.analyze_current(db)

    if event is None:
        ks_threshold, _ = get_drift_thresholds()
        return {
            "status": {
                "ks_score": 0.0,
                "threshold": ks_threshold,
                "drift_detected": False,
                "last_check": None,
                "reference_size": (
                    snapshot["reference_size"] if snapshot else 0
                ),
                "recent_size": (
                    snapshot["recent_size"] if snapshot else 0
                ),
                "features_monitored": 2,
                "drifted_features": (
                    sum(
                        1
                        for s in snapshot["summaries"].values()
                        if s["drift_status"] == "DRIFT"
                    )
                    if snapshot
                    else 0
                ),
                "fraud_rate_change": 0.0,
                "fraud_rate_threshold": fraud_threshold,
                "severity": None,
                "drift_event_id": None,
                "note": (
                    "Drift detection has never run. "
                    "Run drift detection to persist a baseline."
                ),
            },
            "features": (
                [
                    {"feature": name, **summary}
                    for name, summary in snapshot[
                        "summaries"
                    ].items()
                ]
                if snapshot
                else []
            ),
            "snapshot_only": True,
            "events": [],
            "fraud_rate_history": _daily_rates(db),
        }

    return {
        "status": {
            "ks_score": float(event.ks_score),
            "threshold": float(event.threshold),
            "drift_detected": bool(event.drift_detected),
            "last_check": event.detected_at,
            "reference_size": (
                snapshot["reference_size"] if snapshot else None
            ),
            "recent_size": (
                snapshot["recent_size"] if snapshot else None
            ),
            "features_monitored": 2,
            "drifted_features": (
                sum(
                    1
                    for s in snapshot["summaries"].values()
                    if s["drift_status"] == "DRIFT"
                )
                if snapshot
                else None
            ),
            "fraud_rate_change": None,
            "fraud_rate_threshold": fraud_threshold,
            "severity": event.severity,
            "drift_event_id": str(event.id),
        },
        "features": (
            [
                {"feature": name, **summary}
                for name, summary in snapshot["summaries"].items()
            ]
            if snapshot
            else []
        ),
        "snapshot_only": True,
        "events": _recent_events(db),
        "fraud_rate_history": _daily_rates(db),
    }


@router.post("/run")
def run_detection(db: Session = Depends(get_db)):
    result = drift.detect_drift(db)

    gate = maybe_trigger_from_event(
        result["drift_event_id"], db
    )

    return {**result, "retraining": gate}
