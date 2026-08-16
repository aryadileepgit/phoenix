from pathlib import Path

import joblib
import pandas as pd

from sklearn.preprocessing import LabelEncoder, MinMaxScaler

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.preprocessing_report import PreprocessingReport


# --------------------------------------------------
# Storage paths
# --------------------------------------------------

PROCESSED_PATH = Path("storage/processed")
PREPROCESSED_PATH = Path("storage/preprocessed")
PREPROCESSING_MODEL_PATH = Path("storage/preprocessing_models")


# --------------------------------------------------
# Columns NOT used by the fraud detection model
# --------------------------------------------------

EXCLUDED_COLUMNS = [
    "nameOrig",
    "nameDest"
]


# --------------------------------------------------
# Target column
# --------------------------------------------------

TARGET_COLUMN = "isFraud"


# --------------------------------------------------
# Preprocess Dataset
# --------------------------------------------------

def preprocess_dataset(dataset_id, db: Session):

    # --------------------------------------------------
    # Create output folders
    # --------------------------------------------------

    PREPROCESSED_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    PREPROCESSING_MODEL_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------
    # Find Dataset
    # --------------------------------------------------

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id
    ).first()

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    # --------------------------------------------------
    # Load Clean Dataset
    # --------------------------------------------------

    cleaned_file = (
        PROCESSED_PATH /
        f"{dataset.dataset_name}_clean.csv"
    )

    if not cleaned_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Cleaned dataset not found."
        )

    try:

        df = pd.read_csv(
            cleaned_file
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to load cleaned dataset: {str(e)}"
            )
        )

    rows_processed = len(df)

    # --------------------------------------------------
    # Check Target Column
    # --------------------------------------------------

    if TARGET_COLUMN not in df.columns:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Target column '{TARGET_COLUMN}' "
                "not found in dataset."
            )
        )

    # --------------------------------------------------
    # Remove Account Identifier Columns
    # --------------------------------------------------

    removed_columns = []

    for column in EXCLUDED_COLUMNS:

        if column in df.columns:

            df = df.drop(
                columns=[column]
            )

            removed_columns.append(
                column
            )

    # --------------------------------------------------
    # Create Dataset-Specific Preprocessing Folder
    # --------------------------------------------------

    dataset_preprocessing_path = (
        PREPROCESSING_MODEL_PATH /
        str(dataset.id)
    )

    dataset_preprocessing_path.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------
    # Encode Categorical Columns
    # --------------------------------------------------

    # Do NOT encode the target column here.
    # isFraud is already numeric (0/1).

    categorical_columns = (
        df.select_dtypes(
            include=["object", "string"]
        ).columns.tolist()
    )

    encoders = {}

    encoded_count = 0

    for column in categorical_columns:

        encoder = LabelEncoder()

        df[column] = encoder.fit_transform(
            df[column].astype(str)
        )

        encoders[column] = encoder

        encoded_count += 1

    # --------------------------------------------------
    # Scale Numeric Feature Columns
    # --------------------------------------------------
    #
    # IMPORTANT:
    # isFraud is the TARGET.
    # It must NOT be included in the scaler.
    #
    # The scaler should only learn from model features.
    # --------------------------------------------------

    numeric_columns = (
        df.select_dtypes(
            include=["int64", "float64"]
        ).columns.tolist()
    )

    if TARGET_COLUMN in numeric_columns:

        numeric_columns.remove(
            TARGET_COLUMN
        )

    scaler = MinMaxScaler()

    if len(numeric_columns) > 0:

        df[numeric_columns] = scaler.fit_transform(
            df[numeric_columns]
        )

    scaled_count = len(numeric_columns)

    # --------------------------------------------------
    # Save Preprocessed Dataset
    # --------------------------------------------------

    filename = (
        f"{dataset.dataset_name}_preprocessed.csv"
    )

    output_path = (
        PREPROCESSED_PATH /
        filename
    )

    try:

        df.to_csv(
            output_path,
            index=False
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to save preprocessed dataset: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Save Encoders
    # --------------------------------------------------

    encoder_path = (
        dataset_preprocessing_path /
        "encoders.joblib"
    )

    try:

        joblib.dump(
            encoders,
            encoder_path
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to save encoders: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Save Scaler
    # --------------------------------------------------

    scaler_path = (
        dataset_preprocessing_path /
        "scaler.joblib"
    )

    try:

        joblib.dump(
            scaler,
            scaler_path
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to save scaler: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Save Preprocessing Report
    # --------------------------------------------------

    report = PreprocessingReport(

        dataset_id=dataset.id,

        rows_processed=rows_processed,

        categorical_encoded=encoded_count,

        numerical_scaled=scaled_count,

        output_file=str(output_path),

        status="Completed"
    )

    db.add(report)

    db.commit()

    db.refresh(report)

    # --------------------------------------------------
    # Display Information
    # --------------------------------------------------

    print("\n========================================")
    print("PREPROCESSING COMPLETED")
    print("========================================")

    print(
        "Dataset ID:",
        dataset.id
    )

    print(
        "Rows processed:",
        rows_processed
    )

    print(
        "Excluded columns:",
        removed_columns
    )

    print(
        "Target column excluded from scaling:",
        TARGET_COLUMN
    )

    print(
        "Categorical columns encoded:",
        encoded_count
    )

    print(
        "Numeric feature columns scaled:",
        scaled_count
    )

    print(
        "Preprocessed dataset:",
        output_path
    )

    print(
        "Encoders:",
        encoder_path
    )

    print(
        "Scaler:",
        scaler_path
    )

    print("========================================\n")

    # --------------------------------------------------
    # Return Response
    # --------------------------------------------------

    return {

        "dataset_id": str(
            dataset.id
        ),

        "rows_processed": rows_processed,

        "excluded_columns": removed_columns,

        "target_column": TARGET_COLUMN,

        "target_excluded_from_scaling": True,

        "categorical_encoded": encoded_count,

        "numerical_scaled": scaled_count,

        "output_file": filename,

        "preprocessing_artifacts": {

            "encoders": str(
                encoder_path
            ),

            "scaler": str(
                scaler_path
            )
        },

        "status": "Completed"
    }