from pathlib import Path

import pandas as pd
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.feature_engineering_report import FeatureEngineeringReport


BALANCED_PATH = Path("storage/balanced")
ENGINEERED_PATH = Path("storage/engineered")


def feature_engineering(dataset_id, db: Session):

    # ---------------------------------
    # Create output folder
    # ---------------------------------
    ENGINEERED_PATH.mkdir(parents=True, exist_ok=True)

    # ---------------------------------
    # Find Dataset
    # ---------------------------------
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id
    ).first()

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    # ---------------------------------
    # Load Balanced Dataset
    # ---------------------------------
    input_file = BALANCED_PATH / f"{dataset.dataset_name}_balanced.csv"

    if not input_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Balanced dataset not found."
        )

    df = pd.read_csv(input_file)

    original_features = len(df.columns)

    # ---------------------------------
    # Feature 1
    # Sender balance change
    # ---------------------------------
    df["origin_balance_change"] = (
        df["oldbalanceOrg"] - df["newbalanceOrig"]
    )

    # ---------------------------------
    # Feature 2
    # Receiver balance change
    # ---------------------------------
    df["destination_balance_change"] = (
        df["newbalanceDest"] - df["oldbalanceDest"]
    )

    # ---------------------------------
    # Feature 3
    # Difference between both balance changes
    # ---------------------------------
    df["balance_difference"] = (
        df["origin_balance_change"]
        - df["destination_balance_change"]
    ).abs()

    # ---------------------------------
    # Feature 4
    # Amount to sender balance ratio
    # ---------------------------------
    df["amount_to_origin_ratio"] = (
        df["amount"] /
        (df["oldbalanceOrg"] + 1)
    )

    # ---------------------------------
    # Feature 5
    # Large transaction flag
    # ---------------------------------
    median_amount = df["amount"].median()

    df["is_large_transaction"] = (
        df["amount"] > median_amount
    ).astype(int)

    engineered_features = len(df.columns)

    # ---------------------------------
    # Save Engineered Dataset
    # ---------------------------------
    filename = f"{dataset.dataset_name}_engineered.csv"

    output_path = ENGINEERED_PATH / filename

    df.to_csv(output_path, index=False)

    # ---------------------------------
    # Save Report
    # ---------------------------------
    report = FeatureEngineeringReport(
        dataset_id=dataset.id,
        original_features=original_features,
        engineered_features=engineered_features,
        output_file=str(output_path),
        status="Completed"
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    # ---------------------------------
    # Return Response
    # ---------------------------------
    return {
        "dataset_id": str(dataset.id),
        "original_features": original_features,
        "engineered_features": engineered_features,
        "new_features_created": 5,
        "output_file": filename,
        "status": "Completed"
    }