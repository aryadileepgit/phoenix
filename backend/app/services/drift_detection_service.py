from typing import Optional

from scipy import stats
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.drift_event import DriftEvent
from app.models.drift_window import DriftWindow
from app.models.ml_model import MLModel
from app.models.transaction import Transaction

DRIFT_THRESHOLD = 0.05
FRAUD_RATE_THRESHOLD = 0.10


def compute_ks_test(reference_values, current_values) -> dict:
    ks_statistic, p_value = stats.ks_2samp(reference_values, current_values)
    return {
        "ks_score": round(float(ks_statistic), 6),
        "p_value": round(float(p_value), 6),
    }


def monitor_fraud_rate(dataset_id: str, db: Session) -> dict:
    transactions = (
        db.query(Transaction)
        .filter(Transaction.dataset_id == dataset_id)
        .all()
    )

    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found for dataset.")

    total = len(transactions)
    fraud_count = sum(1 for t in transactions if t.actual_label)
    overall_fraud_rate = fraud_count / total if total > 0 else 0.0

    half = total // 2
    historical = transactions[:half] if half > 0 else transactions
    recent = transactions[half:] if half > 0 else transactions

    historical_fraud = (
        sum(1 for t in historical if t.actual_label) / len(historical)
        if historical else 0.0
    )
    recent_fraud = (
        sum(1 for t in recent if t.actual_label) / len(recent)
        if recent else 0.0
    )

    fraud_rate_change = abs(recent_fraud - historical_fraud)
    fraud_rate_increasing = recent_fraud > historical_fraud

    return {
        "dataset_id": dataset_id,
        "historical_fraud_rate": round(historical_fraud, 4),
        "recent_fraud_rate": round(recent_fraud, 4),
        "fraud_rate_change": round(fraud_rate_change, 4),
        "fraud_rate_increasing": fraud_rate_increasing,
        "overall_fraud_rate": round(overall_fraud_rate, 4),
        "alert": fraud_rate_change > FRAUD_RATE_THRESHOLD,
    }


def detect_drift(dataset_id: str, db: Session) -> dict:
    model = (
        db.query(MLModel)
        .filter(MLModel.id == dataset_id)
        .first()
    )
    if model is None:
        model_record = (
            db.query(MLModel)
            .order_by(MLModel.created_at.desc())
            .first()
        )
        if model_record is None:
            raise HTTPException(status_code=404, detail="No ML model found.")
        model = model_record

    transactions = (
        db.query(Transaction)
        .filter(Transaction.dataset_id == dataset_id)
        .order_by(Transaction.created_at)
        .all()
    )

    if len(transactions) < 2:
        raise HTTPException(status_code=400, detail="Insufficient transactions for drift detection.")

    total = len(transactions)
    half = total // 2
    if half == 0:
        half = 1

    historical_window = transactions[:half]
    recent_window = transactions[half:]

    historical_amounts = [float(t.amount) for t in historical_window]
    recent_amounts = [float(t.amount) for t in recent_window]

    historical_balance_changes = [
        float(t.sender_balance_before - t.sender_balance_after) for t in historical_window
    ]
    recent_balance_changes = [
        float(t.sender_balance_before - t.sender_balance_after) for t in recent_window
    ]

    ks_amount = compute_ks_test(historical_amounts, recent_amounts)
    ks_balance = compute_ks_test(historical_balance_changes, recent_balance_changes)

    ks_score = max(ks_amount["ks_score"], ks_balance["ks_score"])

    fraud_monitor = monitor_fraud_rate(dataset_id, db)
    fraud_rate_change = fraud_monitor["fraud_rate_change"]
    drift_detected = ks_score > DRIFT_THRESHOLD or fraud_rate_change > FRAUD_RATE_THRESHOLD

    if ks_score > DRIFT_THRESHOLD and fraud_rate_change > FRAUD_RATE_THRESHOLD:
        severity = "HIGH"
    elif ks_score > DRIFT_THRESHOLD or fraud_rate_change > FRAUD_RATE_THRESHOLD:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    drift_event = DriftEvent(
        model_id=model.id,
        ks_score=ks_score,
        threshold=DRIFT_THRESHOLD,
        severity=severity,
        drift_detected=drift_detected,
    )
    db.add(drift_event)
    db.commit()
    db.refresh(drift_event)

    drift_window = DriftWindow(
        model_id=model.id,
        window_start=historical_window[0].created_at if historical_window else None,
        window_end=recent_window[-1].created_at if recent_window else None,
        ks_score=ks_score,
        fraud_rate_reference=fraud_monitor["historical_fraud_rate"],
        fraud_rate_current=fraud_monitor["recent_fraud_rate"],
        drift_detected=drift_detected,
        severity=severity,
    )
    db.add(drift_window)
    db.commit()
    db.refresh(drift_window)

    return {
        "dataset_id": dataset_id,
        "ks_score": ks_score,
        "ks_amount": ks_amount,
        "ks_balance_change": ks_balance,
        "threshold": DRIFT_THRESHOLD,
        "fraud_rate_change": fraud_rate_change,
        "fraud_rate_threshold": FRAUD_RATE_THRESHOLD,
        "severity": severity,
        "drift_detected": drift_detected,
        "drift_event_id": str(drift_event.id),
        "drift_window_id": str(drift_window.id),
    }
