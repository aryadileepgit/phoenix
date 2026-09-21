from app.database.database import SessionLocal
from app.services.smote_service import apply_smote

DATASET_ID = "f99a1cac-51a4-4d18-9b82-a06d975dd97b"

db = SessionLocal()

try:
    result = apply_smote(DATASET_ID, db)

    print()
    print("=" * 70)
    print("SMOTE RECOVERY COMPLETED")
    print("=" * 70)
    print(result)

finally:
    db.close()