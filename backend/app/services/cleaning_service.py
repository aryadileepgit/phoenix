from pathlib import Path
from pandas.api.types import is_numeric_dtype

import pandas as pd
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.dataset_cleaning import DatasetCleaning


RAW_PATH = Path("storage/raw")
PROCESSED_PATH = Path("storage/processed")


def clean_dataset(dataset_id, db: Session):
    # Create processed folder
    PROCESSED_PATH.mkdir(parents=True, exist_ok=True)

    # Find dataset
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # Read original dataset
    raw_file = RAW_PATH / dataset.original_filename
    if not raw_file.exists():
        raise HTTPException(status_code=404, detail="Raw dataset file not found.")

    df = pd.read_csv(raw_file)
    rows_before = len(df)

    # -----------------------------
    # Remove duplicate rows
    # -----------------------------
    duplicate_rows = int(df.duplicated().sum())
    df = df.drop_duplicates()

    # -----------------------------
    # Handle missing values
    # -----------------------------
    missing_values = int(df.isnull().sum().sum())

    for column in df.columns:
        if is_numeric_dtype(df[column]):
            # Numeric → fill with median
            df[column] = df[column].fillna(df[column].median())
        else:
            # Non-numeric → fill with mode or fallback
            if not df[column].mode().empty:
                df[column] = df[column].fillna(df[column].mode()[0])
            else:
                df[column] = df[column].fillna("Unknown")

    rows_after = len(df)

    # -----------------------------
    # Save cleaned dataset
    # -----------------------------
    cleaned_filename = dataset.dataset_name + "_clean.csv"
    cleaned_path = PROCESSED_PATH / cleaned_filename
    df.to_csv(cleaned_path, index=False)

    # -----------------------------
    # Save cleaning report
    # -----------------------------
    report = DatasetCleaning(
        dataset_id=dataset.id,
        rows_before=rows_before,
        rows_after=rows_after,
        duplicates_removed=duplicate_rows,
        missing_values_fixed=missing_values,
        cleaned_file=str(cleaned_path),
        status="Completed"
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "dataset_id": str(dataset.id),
        "rows_before": rows_before,
        "rows_after": rows_after,
        "duplicates_removed": duplicate_rows,
        "missing_values_fixed": missing_values,
        "cleaned_file": cleaned_filename,
        "status": "Completed"
    }
