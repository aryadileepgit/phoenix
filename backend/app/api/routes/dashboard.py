"""
Fraud operations dashboard aggregation.

Every number comes from stored rows: scored transactions,
the latest ModelReport, the latest DriftEvent, and the
schema registry. Nothing is synthesized. Unavailable
subsystems report null with an explicit note.
"""

from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.database.dependencies import get_db
from app.models.drift_event import DriftEvent
from app.models.model_report import ModelReport
from app.models.retraining_history import RetrainingHistory
from app.models.schema_registry import SchemaRegistry
from app.models.transaction import Transaction


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("")
def get_dashboard(db: Session = Depends(get_db)):
    total = (
        db.query(func.count(Transaction.id)).scalar() or 0
    )
    fraud = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.predicted_label == True)  # noqa: E712
        .scalar()
        or 0
    )
    high_risk = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.risk_level == "HIGH")
        .scalar()
        or 0
    )
    verify = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.decision == "VERIFY")
        .scalar()
        or 0
    )

    risk_rows = (
        db.query(Transaction.risk_level, func.count(Transaction.id))
        .group_by(Transaction.risk_level)
        .all()
    )
    risk_distribution = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    for level, count in risk_rows:
        if level in risk_distribution:
            risk_distribution[level] = int(count or 0)

    decision_rows = (
        db.query(Transaction.decision, func.count(Transaction.id))
        .group_by(Transaction.decision)
        .all()
    )
    decision_distribution = {
        "APPROVE": 0,
        "VERIFY": 0,
        "BLOCK": 0,
    }
    for decision, count in decision_rows:
        if decision in decision_distribution:
            decision_distribution[decision] = int(count or 0)

    recent = (
        db.query(Transaction)
        .order_by(desc(Transaction.created_at))
        .limit(10)
        .all()
    )

    model_report = (
        db.query(ModelReport)
        .order_by(desc(ModelReport.created_at))
        .first()
    )

    drift_event = (
        db.query(DriftEvent)
        .order_by(desc(DriftEvent.detected_at))
        .first()
    )

    pending_mappings = (
        db.query(func.count(SchemaRegistry.id))
        .filter(SchemaRegistry.approval_status != "Approved")
        .scalar()
        or 0
    )

    retraining = (
        db.query(RetrainingHistory)
        .order_by(desc(RetrainingHistory.completed_at))
        .first()
    )

    fraud_activity = _daily_activity(db)

    return {
        "kpis": {
            "totalTransactions": total,
            "fraudDetected": fraud,
            "highRiskTransactions": high_risk,
            "verificationRequired": verify,
        },
        "model": (
            {
                "name": model_report.model_name,
                "accuracy": float(model_report.accuracy),
                "roc_auc": float(model_report.roc_auc),
            }
            if model_report
            else None
        ),
        "drift": (
            {
                "status": (
                    "drift"
                    if drift_event.drift_detected
                    else "stable"
                ),
                "severity": drift_event.severity,
                "last_check": drift_event.detected_at,
            }
            if drift_event
            else {
                "status": "never_run",
                "severity": None,
                "last_check": None,
            }
        ),
        "riskDistribution": risk_distribution,
        "decisionDistribution": decision_distribution,
        "recentTransactions": [
            {
                "transaction_id": t.transaction_id,
                "account_id": t.account_id,
                "amount": float(t.amount),
                "transaction_time": t.transaction_time,
                "fraud_probability": (
                    float(t.fraud_probability)
                    if t.fraud_probability is not None
                    else None
                ),
                "risk_level": t.risk_level,
                "decision": t.decision,
            }
            for t in recent
        ],
        "fraudActivity": fraud_activity,
        "system": {
            "schemaPendingMappings": int(pending_mappings),
            "lastRetraining": (
                retraining.completed_at
                if retraining
                else None
            ),
        },
    }


def _daily_activity(db: Session, limit: int = 14):
    from sqlalchemy import Integer, cast

    day = func.date_trunc("day", Transaction.created_at)
    rows = (
        db.query(
            day.label("day"),
            func.sum(
                func.cast(Transaction.predicted_label, Integer)
            ).label("fraud"),
            func.sum(
                func.cast(
                    Transaction.risk_level == "HIGH", Integer
                )
            ).label("high_risk"),
            func.sum(
                func.cast(
                    Transaction.decision == "BLOCK", Integer
                ),
            ).label("blocked"),
        )
        .group_by(day)
        .order_by(day.asc())
        .all()
    )[-limit:]

    return [
        {
            "date": row.day.isoformat() if row.day else None,
            "fraud": int(row.fraud or 0),
            "highRisk": int(row.high_risk or 0),
            "blocked": int(row.blocked or 0),
        }
        for row in rows
    ]
