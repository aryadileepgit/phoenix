from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.risk_profile import RiskProfile
from app.models.transaction import Transaction

RISK_LEVELS = {
    "LOW": (0, 30),
    "MEDIUM": (31, 60),
    "HIGH": (61, 80),
    "CRITICAL": (81, 100),
}


def calculate_risk_score(account_data: dict) -> float:
    score = 0.0

    amount_anomaly_factor = account_data.get("amount_anomaly_factor", 0.0)
    score += min(amount_anomaly_factor * 10, 25)

    device_change_factor = account_data.get("device_change_factor", 0.0)
    score += min(device_change_factor * 15, 20)

    location_change_factor = account_data.get("location_change_factor", 0.0)
    score += min(location_change_factor * 15, 20)

    rapid_activity_factor = account_data.get("rapid_activity_factor", 0.0)
    score += min(rapid_activity_factor * 10, 15)

    network_pattern_factor = account_data.get("network_pattern_factor", 0.0)
    score += min(network_pattern_factor * 10, 15)

    fraud_history_factor = account_data.get("fraud_history_factor", 0.0)
    score += min(fraud_history_factor * 5, 10)

    score = min(score, 100)
    return round(score, 2)


def _get_risk_level(score: float) -> str:
    for level, (low, high) in RISK_LEVELS.items():
        if low <= score <= high:
            return level
    return "LOW"


def update_risk_profile(account_id: str, db: Session) -> dict:
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found.")

    transactions = (
        db.query(Transaction)
        .filter(Transaction.sender == account_id)
        .all()
    )

    total_transactions = len(transactions)
    fraud_transactions = sum(1 for t in transactions if t.predicted_label)

    if total_transactions > 0:
        avg_amount = sum(float(t.amount) for t in transactions) / total_transactions
        fraud_rate = fraud_transactions / total_transactions
    else:
        avg_amount = 0.0
        fraud_rate = 0.0

    account_data = {
        "amount_anomaly_factor": min(fraud_rate * 2, 1.0),
        "device_change_factor": min(fraud_rate, 1.0),
        "location_change_factor": min(fraud_rate, 1.0),
        "rapid_activity_factor": min(fraud_rate * 1.5, 1.0),
        "network_pattern_factor": min(fraud_rate, 1.0),
        "fraud_history_factor": fraud_rate,
    }

    risk_score = calculate_risk_score(account_data)
    risk_level = _get_risk_level(risk_score)

    risk_profile = (
        db.query(RiskProfile)
        .filter(RiskProfile.account_id == account.id)
        .first()
    )

    if risk_profile is None:
        risk_profile = RiskProfile(
            account_id=account.id,
            risk_score=risk_score,
            risk_level=risk_level,
            total_transactions=total_transactions,
            fraud_transactions=fraud_transactions,
            avg_amount=avg_amount,
            unusual_devices=0,
            unusual_locations=0,
            last_updated=datetime.utcnow(),
        )
        db.add(risk_profile)
    else:
        risk_profile.risk_score = risk_score
        risk_profile.risk_level = risk_level
        risk_profile.total_transactions = total_transactions
        risk_profile.fraud_transactions = fraud_transactions
        risk_profile.avg_amount = avg_amount
        risk_profile.last_updated = datetime.utcnow()

    db.commit()
    db.refresh(risk_profile)

    account.risk_score = risk_score
    account.risk_level = risk_level
    db.commit()
    db.refresh(account)

    return {
        "account_id": account_id,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "total_transactions": total_transactions,
        "fraud_transactions": fraud_transactions,
        "avg_amount": avg_amount,
    }


def get_all_risk_profiles(db: Session) -> list[dict]:
    risk_profiles = db.query(RiskProfile).all()
    return [
        {
            "account_id": rp.account_id,
            "risk_score": float(rp.risk_score),
            "risk_level": rp.risk_level,
            "total_transactions": rp.total_transactions,
            "fraud_transactions": rp.fraud_transactions,
            "avg_amount": float(rp.avg_amount),
            "unusual_devices": rp.unusual_devices,
            "unusual_locations": rp.unusual_locations,
            "last_updated": rp.last_updated.isoformat() if rp.last_updated else None,
        }
        for rp in risk_profiles
    ]
