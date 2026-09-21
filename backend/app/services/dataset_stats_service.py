from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.dataset import Dataset


# ==================================================
# Storage Paths
# ==================================================

PROCESSED_PATH = Path("storage/processed")
BALANCED_PATH = Path("storage/balanced")


# ==================================================
# Get Dataset Stats
# ==================================================

def get_dataset_stats(dataset_id, db: Session):
    # ----------------------------------------------
    # Find dataset in database
    # ----------------------------------------------

    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id)
        .first()
    )

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    # ----------------------------------------------
    # Defaults
    # ----------------------------------------------

    default_stats = {
        "total_records": 0,
        "total_columns": 0,
        "fraud_count": 0,
        "legitimate_count": 0,
        "fraud_rate": 0.0,
        "feature_names": [],
        "target_column": "isFraud",
        "dataset_name": dataset.dataset_name,
        "source": dataset.original_filename,
        "upload_date": str(dataset.upload_date),
        "status": dataset.status
    }

    # ----------------------------------------------
    # Read cleaned CSV from storage
    # ----------------------------------------------

    cleaned_file = (
        PROCESSED_PATH /
        f"{dataset.dataset_name}_clean.csv"
    )

    if not cleaned_file.exists():
        # Try balanced CSV as fallback
        balanced_file = (
            BALANCED_PATH /
            f"{dataset.dataset_name}_balanced.csv"
        )

        if not balanced_file.exists():
            return default_stats

        csv_file = balanced_file
    else:
        csv_file = cleaned_file

    # ----------------------------------------------
    # Compute statistics from CSV
    # ----------------------------------------------

    try:
        df = pd.read_csv(csv_file)

    except Exception:
        return default_stats

    total_records = len(df)
    total_columns = len(df.columns)

    target_column = "isFraud" if "isFraud" in df.columns else None

    fraud_count = 0
    legitimate_count = 0
    fraud_rate = 0.0

    if target_column is not None:
        fraud_count = int(df[target_column].sum())
        legitimate_count = total_records - fraud_count
        fraud_rate = round(fraud_count / total_records, 4) if total_records > 0 else 0.0

    feature_names = [col for col in df.columns if col != target_column] if target_column else list(df.columns)

    return {
        "total_records": total_records,
        "total_columns": total_columns,
        "fraud_count": fraud_count,
        "legitimate_count": legitimate_count,
        "fraud_rate": fraud_rate,
        "feature_names": feature_names,
        "target_column": target_column,
        "dataset_name": dataset.dataset_name,
        "source": dataset.original_filename,
        "upload_date": str(dataset.upload_date),
        "status": dataset.status
    }
