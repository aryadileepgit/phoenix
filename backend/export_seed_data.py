import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from app.database.database import SessionLocal
from app.models.dataset import Dataset
from app.models.drift_event import DriftEvent
from app.models.ml_model import MLModel
from app.models.model_report import ModelReport
from app.models.retraining_history import RetrainingHistory
from app.models.transaction import Transaction


def serialize_val(val):
    if isinstance(val, (datetime,)):
        return val.isoformat()
    if isinstance(val, (Decimal,)):
        return float(val)
    if isinstance(val, (uuid.UUID,)):
        return str(val)
    if isinstance(val, dict):
        return {k: serialize_val(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_val(v) for v in val]
    return val


def row_to_dict(model_obj):
    return {
        col.name: serialize_val(getattr(model_obj, col.name))
        for col in model_obj.__table__.columns
    }


def main():
    db = SessionLocal()
    try:
        # Datasets
        datasets = [row_to_dict(d) for d in db.query(Dataset).all()]

        # ML Models
        ml_models = [row_to_dict(m) for m in db.query(MLModel).all()]

        # Latest Model Reports
        model_reports = [
            row_to_dict(r)
            for r in db.query(ModelReport)
            .order_by(ModelReport.created_at.desc())
            .limit(3)
            .all()
        ]

        # Retraining History
        retraining_history = [
            row_to_dict(h)
            for h in db.query(RetrainingHistory)
            .order_by(RetrainingHistory.completed_at.desc())
            .all()
        ]

        # Drift Events
        drift_events = [
            row_to_dict(e)
            for e in db.query(DriftEvent)
            .order_by(DriftEvent.detected_at.desc())
            .limit(10)
            .all()
        ]

        # Sample transactions: pick HIGH, MEDIUM, LOW risks to give realistic distribution
        high_txns = (
            db.query(Transaction)
            .filter(Transaction.risk_level == "HIGH")
            .order_by(Transaction.created_at.desc())
            .limit(60)
            .all()
        )
        med_txns = (
            db.query(Transaction)
            .filter(Transaction.risk_level == "MEDIUM")
            .order_by(Transaction.created_at.desc())
            .limit(80)
            .all()
        )
        low_txns = (
            db.query(Transaction)
            .filter(Transaction.risk_level == "LOW")
            .order_by(Transaction.created_at.desc())
            .limit(160)
            .all()
        )

        all_txns = high_txns + med_txns + low_txns
        transactions = [row_to_dict(t) for t in all_txns]

        data = {
            "datasets": datasets,
            "ml_models": ml_models,
            "model_reports": model_reports,
            "retraining_history": retraining_history,
            "drift_events": drift_events,
            "transactions": transactions,
        }

        output_path = Path("storage/seed_data.json")
        output_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        print(f"Exported seed data successfully to {output_path}!")
        print(f"Datasets: {len(datasets)}")
        print(f"ML Models: {len(ml_models)}")
        print(f"Model Reports: {len(model_reports)}")
        print(f"Retraining History: {len(retraining_history)}")
        print(f"Drift Events: {len(drift_events)}")
        print(f"Transactions: {len(transactions)}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
