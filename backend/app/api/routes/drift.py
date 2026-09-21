"""
Concept drift on scored API transactions.

The legacy drift service assumed PaySim columns (dataset_id,
sender balances) and an ml_models row that never exists, so it
cannot run on current data. This router implements drift honestly
on the Transaction model: reference = older half by created_at,
recent = newer half, KS tests on amount and fraud_probability,
fraud-rate change, same severity rule. Results persist as
DriftEvent/DriftWindow rows under the deployed-model record
(created from the real model_metadata.json when missing).
"""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from scipy.stats import ks_2samp
from sqlalchemy import Integer, desc
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.drift_event import DriftEvent
from app.models.drift_window import DriftWindow
from app.models.ml_model import MLModel
from app.models.transaction import Transaction
from app.services.runtime_settings import get_drift_thresholds


router = APIRouter(
    prefix="/drift",
    tags=["Concept Drift"],
)

MODEL_METADATA_PATH = Path(
    "storage/models/f99a1cac-51a4-4d18-9b82-a06d975dd97b"
    "/model_metadata.json"
)

FEATURES = ("amount", "fraud_probability")


def _mean(values):
    return sum(values) / len(values) if values else 0.0


def _std(values, mean):
    if len(values) < 2:
        return 0.0
    return (
        sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    ) ** 0.5


def _ensure_deployed_model(db: Session):
    model = (
        db.query(MLModel)
        .order_by(desc(MLModel.created_at))
        .first()
    )

    if model is not None:
        return model

    metadata = {}
    if MODEL_METADATA_PATH.exists():
        try:
            metadata = json.loads(
                MODEL_METADATA_PATH.read_text(encoding="utf-8")
            )
        except (OSError, ValueError):
            metadata = {}

    model = MLModel(
        model_name=metadata.get(
            "model_name", "Phoenix XGBoost Fraud Detector"
        ),
        algorithm=metadata.get("algorithm", "XGBoost"),
        version="1.0",
        accuracy=float(metadata.get("accuracy", 0.0)),
        precision=float(metadata.get("precision", 0.0)),
        recall=float(metadata.get("recall", 0.0)),
        f1_score=float(metadata.get("f1_score", 0.0)),
        roc_auc=float(metadata.get("roc_auc", 0.0)),
        model_path=str(
            MODEL_METADATA_PATH.parent
            / "phoenix_xgboost_model.joblib"
        ),
        trained_on_dataset=str(
            metadata.get(
                "dataset_id",
                "f99a1cac-51a4-4d18-9b82-a06d975dd97b",
            )
        ),
        status="Deployed",
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    return model


def _scored_rows(db: Session):
    return (
        db.query(Transaction)
        .filter(Transaction.fraud_probability != None)  # noqa: E711
        .order_by(Transaction.created_at.asc())
        .all()
    )


def _feature_values(rows, feature):
    values = []
    for row in rows:
        value = getattr(row, feature)
        if value is not None:
            values.append(float(value))
    return values


def _summarize(reference, recent, ks_threshold):
    result = _ks(reference, recent)

    if result["ks_statistic"] > ks_threshold:
        status = "DRIFT"
    elif result["ks_statistic"] > ks_threshold * 0.5:
        status = "WARNING"
    else:
        status = "STABLE"

    ref_mean = _mean(reference)
    rec_mean = _mean(recent)

    return {
        "ks_statistic": result["ks_statistic"],
        "p_value": result["p_value"],
        "drift_status": status,
        "reference_mean": ref_mean,
        "reference_std": _std(reference, ref_mean),
        "recent_mean": rec_mean,
        "recent_std": _std(recent, rec_mean),
        "reference_size": len(reference),
        "recent_size": len(recent),
    }


def _ks(reference, recent):
    if not reference or not recent:
        return {"ks_statistic": 0.0, "p_value": 1.0}

    outcome = ks_2samp(reference, recent)

    return {
        "ks_statistic": round(float(outcome.statistic), 6),
        "p_value": float(outcome.pvalue),
    }


def _fraud_rate(rows):
    if not rows:
        return 0.0
    flagged = sum(1 for row in rows if row.predicted_label is True)
    return flagged / len(rows)


def _live_snapshot(db: Session):
    """
    Current feature snapshot recomputed from scored rows.
    Labeled as a snapshot: it is NOT a persisted detection run.
    """

    ks_threshold, _ = get_drift_thresholds()
    rows = _scored_rows(db)

    if len(rows) < 4:
        return None

    half = len(rows) // 2
    reference = rows[:half]
    recent = rows[half:]

    summaries = [
        {
            "feature": feature,
            **_summarize(
                _feature_values(reference, feature),
                _feature_values(recent, feature),
                ks_threshold,
            ),
        }
        for feature in FEATURES
    ]

    return {
        "summaries": summaries,
        "reference_size": len(reference),
        "recent_size": len(recent),
        "drifted_features": sum(
            1 for s in summaries if s["drift_status"] == "DRIFT"
        ),
    }


def _status_payload(db: Session):
    ks_threshold, fraud_threshold = get_drift_thresholds()

    event = (
        db.query(DriftEvent)
        .order_by(desc(DriftEvent.detected_at))
        .first()
    )

    snapshot = _live_snapshot(db)

    if event is None:
        return {
            "status": {
                "ks_score": 0.0,
                "threshold": ks_threshold,
                "drift_detected": False,
                "last_check": None,
                "reference_size": (
                    snapshot["reference_size"]
                    if snapshot
                    else 0
                ),
                "recent_size": (
                    snapshot["recent_size"] if snapshot else 0
                ),
                "features_monitored": len(FEATURES),
                "drifted_features": (
                    snapshot["drifted_features"]
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
                snapshot["summaries"] if snapshot else []
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
            "features_monitored": len(FEATURES),
            "drifted_features": (
                snapshot["drifted_features"] if snapshot else None
            ),
            "fraud_rate_change": None,
            "fraud_rate_threshold": fraud_threshold,
            "severity": event.severity,
            "drift_event_id": str(event.id),
        },
        "features": snapshot["summaries"] if snapshot else [],
        "snapshot_only": True,
        "events": _recent_events(db),
        "fraud_rate_history": _daily_rates(db),
    }


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
    from sqlalchemy import func

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
    return _status_payload(db)


@router.post("/run")
def run_detection(db: Session = Depends(get_db)):
    ks_threshold, fraud_threshold = get_drift_thresholds()

    rows = _scored_rows(db)

    if len(rows) < 4:
        raise HTTPException(
            status_code=400,
            detail=(
                "Insufficient scored transactions for drift "
                "detection (need at least 4)."
            ),
        )

    half = len(rows) // 2
    reference = rows[:half]
    recent = rows[half:]

    summaries = {
        feature: _summarize(
            _feature_values(reference, feature),
            _feature_values(recent, feature),
            ks_threshold,
        )
        for feature in FEATURES
    }

    ks_score = max(
        s["ks_statistic"] for s in summaries.values()
    )

    ref_rate = _fraud_rate(reference)
    rec_rate = _fraud_rate(recent)
    fraud_rate_change = round(rec_rate - ref_rate, 6)

    drift_detected = (
        ks_score > ks_threshold
        or abs(fraud_rate_change) > fraud_threshold
    )

    if ks_score > ks_threshold and abs(fraud_rate_change) > fraud_threshold:
        severity = "HIGH"
    elif ks_score > ks_threshold or abs(fraud_rate_change) > fraud_threshold:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    model = _ensure_deployed_model(db)

    event = DriftEvent(
        model_id=model.id,
        ks_score=ks_score,
        threshold=ks_threshold,
        severity=severity,
        drift_detected=drift_detected,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    window = DriftWindow(
        model_id=model.id,
        window_start=reference[0].created_at,
        window_end=recent[-1].created_at,
        ks_score=ks_score,
        fraud_rate_reference=round(ref_rate, 6),
        fraud_rate_current=round(rec_rate, 6),
        drift_detected=drift_detected,
        severity=severity,
    )
    db.add(window)
    db.commit()
    db.refresh(window)

    return {
        "drift_detected": drift_detected,
        "ks_score": ks_score,
        "threshold": ks_threshold,
        "severity": severity,
        "fraud_rate_change": fraud_rate_change,
        "fraud_rate_threshold": fraud_threshold,
        "drift_event_id": str(event.id),
        "features": [
            {"feature": name, **summary}
            for name, summary in summaries.items()
        ],
        "reference_size": len(reference),
        "recent_size": len(recent),
    }
