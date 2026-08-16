from pathlib import Path

import pandas as pd
from fastapi import HTTPException
from imblearn.over_sampling import SMOTE
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.smote_report import SMOTEReport


PREPROCESSED_PATH = Path("storage/preprocessed")
BALANCED_PATH = Path("storage/balanced")


def apply_smote(dataset_id, db: Session):

    # ---------------------------------
    # Create Output Folder
    # ---------------------------------
    BALANCED_PATH.mkdir(parents=True, exist_ok=True)

    # ---------------------------------
    # Find Dataset
    # ---------------------------------
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

    # ---------------------------------
    # Load Preprocessed Dataset
    # ---------------------------------
    input_file = PREPROCESSED_PATH / f"{dataset.dataset_name}_preprocessed.csv"

    if not input_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Preprocessed dataset not found."
        )

    df = pd.read_csv(input_file)

    # ---------------------------------
    # Check Target Column
    # ---------------------------------
    if "isFraud" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Target column 'isFraud' not found."
        )

    X = df.drop(columns=["isFraud"])
    y = df["isFraud"]

    rows_before = len(df)
    fraud_before = int(y.sum())

    # ---------------------------------
    # Check Class Distribution
    # ---------------------------------
    class_counts = y.value_counts()

    if len(class_counts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Dataset contains only one class. SMOTE cannot be applied."
        )

    minority_samples = class_counts.min()

    # Need at least 2 minority samples
    if minority_samples < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough minority samples to apply SMOTE."
        )

    # ---------------------------------
    # Dynamically choose k_neighbors
    # ---------------------------------
    k = min(5, minority_samples - 1)

    smote = SMOTE(
        random_state=42,
        k_neighbors=k
    )

    X_resampled, y_resampled = smote.fit_resample(X, y)

    balanced_df = X_resampled.copy()
    balanced_df["isFraud"] = y_resampled

    rows_after = len(balanced_df)
    fraud_after = int(y_resampled.sum())

    # ---------------------------------
    # Save Balanced Dataset
    # ---------------------------------
    filename = f"{dataset.dataset_name}_balanced.csv"

    output_path = BALANCED_PATH / filename

    balanced_df.to_csv(output_path, index=False)

    # ---------------------------------
    # Save Report
    # ---------------------------------
    report = SMOTEReport(
        dataset_id=dataset.id,
        rows_before=rows_before,
        rows_after=rows_after,
        fraud_before=fraud_before,
        fraud_after=fraud_after,
        output_file=str(output_path),
        status="Completed",
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    # ---------------------------------
    # Return Response
    # ---------------------------------
    return {
        "dataset_id": str(dataset.id),
        "rows_before": rows_before,
        "rows_after": rows_after,
        "fraud_before": fraud_before,
        "fraud_after": fraud_after,
        "output_file": filename,
        "status": "Completed",
    }