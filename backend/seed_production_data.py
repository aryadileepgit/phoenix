import json
import logging
import uuid
from datetime import datetime
from pathlib import Path

from app.database.database import SessionLocal
from app.models.dataset import Dataset
from app.models.drift_event import DriftEvent
from app.models.ml_model import MLModel
from app.models.model_report import ModelReport
from app.models.retraining_history import RetrainingHistory
from app.models.transaction import Transaction
from app.models.user import User

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed-production")

SEED_FILE = Path("storage/seed_data.json")


def parse_val(k, v):
    if v is None:
        return None
    if isinstance(v, str):
        if "date" in k or "time" in k or "at" in k:
            try:
                return datetime.fromisoformat(v)
            except Exception:
                pass
        if "id" in k or k == "uploaded_by" or k == "trained_on_dataset":
            try:
                return uuid.UUID(v)
            except Exception:
                pass
    return v


def seed_production():
    if not SEED_FILE.exists():
        logger.warning(f"Seed file {SEED_FILE} not found. Skipping production seeding.")
        return False

    db = SessionLocal()
    try:
        report_count = db.query(ModelReport).count()
        transaction_count = db.query(Transaction).count()

        if report_count > 0 and transaction_count > 0:
            logger.info(
                f"Database already populated (ModelReports: {report_count}, Transactions: {transaction_count}). Skipping seed."
            )
            return True

        logger.info(f"Loading seed data from {SEED_FILE}...")
        raw_data = json.loads(SEED_FILE.read_text(encoding="utf-8"))

        admin_user = db.query(User).first()
        admin_id = admin_user.id if admin_user else None

        # 1. Transactions (No foreign keys, safe to insert first!)
        try:
            existing_t_ids = {str(t.transaction_id) for t in db.query(Transaction.transaction_id).all()}
            inserted_txns = 0
            for item in raw_data.get("transactions", []):
                if str(item.get("transaction_id")) not in existing_t_ids:
                    row_data = {k: parse_val(k, v) for k, v in item.items()}
                    db.add(Transaction(**row_data))
                    inserted_txns += 1
            db.commit()
            logger.info(f"Seeded {inserted_txns} transactions.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding transactions: {e}")

        # 2. Datasets
        try:
            existing_ds_ids = {str(d.id) for d in db.query(Dataset.id).all()}
            inserted_ds = 0
            for item in raw_data.get("datasets", []):
                if str(item.get("id")) not in existing_ds_ids:
                    row_data = {k: parse_val(k, v) for k, v in item.items()}
                    if admin_id:
                        row_data["uploaded_by"] = admin_id
                    db.add(Dataset(**row_data))
                    inserted_ds += 1
            db.commit()
            logger.info(f"Seeded {inserted_ds} datasets.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding datasets: {e}")

        # 3. ML Models
        try:
            existing_m_ids = {str(m.id) for m in db.query(MLModel.id).all()}
            inserted_m = 0
            for item in raw_data.get("ml_models", []):
                if str(item.get("id")) not in existing_m_ids:
                    row_data = {k: parse_val(k, v) for k, v in item.items()}
                    db.add(MLModel(**row_data))
                    inserted_m += 1
            db.commit()
            logger.info(f"Seeded {inserted_m} ML models.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding ML models: {e}")

        # 4. Model Reports
        try:
            existing_r_ids = {str(r.id) for r in db.query(ModelReport.id).all()}
            inserted_r = 0
            for item in raw_data.get("model_reports", []):
                if str(item.get("id")) not in existing_r_ids:
                    row_data = {k: parse_val(k, v) for k, v in item.items()}
                    db.add(ModelReport(**row_data))
                    inserted_r += 1
            db.commit()
            logger.info(f"Seeded {inserted_r} model reports.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding model reports: {e}")

        # 5. Drift Events
        try:
            existing_e_ids = {str(e.id) for e in db.query(DriftEvent.id).all()}
            inserted_e = 0
            for item in raw_data.get("drift_events", []):
                if str(item.get("id")) not in existing_e_ids:
                    row_data = {k: parse_val(k, v) for k, v in item.items()}
                    db.add(DriftEvent(**row_data))
                    inserted_e += 1
            db.commit()
            logger.info(f"Seeded {inserted_e} drift events.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding drift events: {e}")

        # 6. Retraining History
        try:
            existing_h_ids = {str(h.id) for h in db.query(RetrainingHistory.id).all()}
            inserted_h = 0
            for item in raw_data.get("retraining_history", []):
                if str(item.get("id")) not in existing_h_ids:
                    row_data = {k: parse_val(k, v) for k, v in item.items()}
                    db.add(RetrainingHistory(**row_data))
                    inserted_h += 1
            db.commit()
            logger.info(f"Seeded {inserted_h} retraining history records.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding retraining history: {e}")

        logger.info("Production baseline data seeding process completed.")
        return True
    finally:
        db.close()


if __name__ == "__main__":
    seed_production()
