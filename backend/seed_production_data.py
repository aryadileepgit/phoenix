import json
import logging
from datetime import datetime
from pathlib import Path

from app.database.database import SessionLocal
from app.models.dataset import Dataset
from app.models.drift_event import DriftEvent
from app.models.ml_model import MLModel
from app.models.model_report import ModelReport
from app.models.retraining_history import RetrainingHistory
from app.models.transaction import Transaction

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed-production")

SEED_FILE = Path("storage/seed_data.json")


def parse_date(val):
    if val and isinstance(val, str):
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return None
    return val


def seed_production():
    if not SEED_FILE.exists():
        logger.warning(f"Seed file {SEED_FILE} not found. Skipping production seeding.")
        return

    db = SessionLocal()
    try:
        report_count = db.query(ModelReport).count()
        transaction_count = db.query(Transaction).count()

        if report_count > 0 and transaction_count > 0:
            logger.info(
                f"Database already populated (ModelReports: {report_count}, Transactions: {transaction_count}). Skipping seed."
            )
            return

        logger.info(f"Loading seed data from {SEED_FILE}...")
        raw_data = json.loads(SEED_FILE.read_text(encoding="utf-8"))

        # 1. Datasets
        existing_ds_ids = {str(d.id) for d in db.query(Dataset.id).all()}
        for item in raw_data.get("datasets", []):
            if str(item.get("id")) not in existing_ds_ids:
                row = Dataset(**{k: parse_date(v) if "date" in k or "time" in k else v for k, v in item.items()})
                db.add(row)
        db.commit()

        # 2. ML Models
        existing_m_ids = {str(m.id) for m in db.query(MLModel.id).all()}
        for item in raw_data.get("ml_models", []):
            if str(item.get("id")) not in existing_m_ids:
                row = MLModel(**{k: parse_date(v) if "date" in k or "time" in k or "at" in k else v for k, v in item.items()})
                db.add(row)
        db.commit()

        # 3. Model Reports
        existing_r_ids = {str(r.id) for r in db.query(ModelReport.id).all()}
        for item in raw_data.get("model_reports", []):
            if str(item.get("id")) not in existing_r_ids:
                row = ModelReport(**{k: parse_date(v) if "date" in k or "time" in k or "at" in k else v for k, v in item.items()})
                db.add(row)
        db.commit()

        # 4. Drift Events
        existing_e_ids = {str(e.id) for e in db.query(DriftEvent.id).all()}
        for item in raw_data.get("drift_events", []):
            if str(item.get("id")) not in existing_e_ids:
                row = DriftEvent(**{k: parse_date(v) if "date" in k or "time" in k or "at" in k else v for k, v in item.items()})
                db.add(row)
        db.commit()

        # 5. Retraining History
        existing_h_ids = {str(h.id) for h in db.query(RetrainingHistory.id).all()}
        for item in raw_data.get("retraining_history", []):
            if str(item.get("id")) not in existing_h_ids:
                row = RetrainingHistory(**{k: parse_date(v) if "date" in k or "time" in k or "at" in k else v for k, v in item.items()})
                db.add(row)
        db.commit()

        # 6. Transactions
        existing_t_ids = {str(t.transaction_id) for t in db.query(Transaction.transaction_id).all()}
        for item in raw_data.get("transactions", []):
            if str(item.get("transaction_id")) not in existing_t_ids:
                row = Transaction(**{k: parse_date(v) if "date" in k or "time" in k or "at" in k else v for k, v in item.items()})
                db.add(row)
        db.commit()

        logger.info("Production baseline data seeded successfully into PostgreSQL!")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed production data: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    seed_production()
