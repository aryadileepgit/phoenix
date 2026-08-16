from pathlib import Path

import pandas as pd

from fastapi import HTTPException
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.training_report import TrainingReport


# --------------------------------------------------
# Storage paths
# --------------------------------------------------

ENGINEERED_PATH = Path("storage/engineered")
TRAINING_PATH = Path("storage/training")


# --------------------------------------------------
# Prepare Training Dataset
# --------------------------------------------------

def prepare_training_dataset(
    dataset_id,
    db: Session
):

    # --------------------------------------------------
    # Find dataset
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
    # Load engineered dataset
    # --------------------------------------------------

    input_file = (
        ENGINEERED_PATH /
        f"{dataset.dataset_name}_engineered.csv"
    )

    if not input_file.exists():

        raise HTTPException(
            status_code=404,
            detail="Engineered dataset not found."
        )

    # --------------------------------------------------
    # Read engineered dataset
    # --------------------------------------------------

    try:

        df = pd.read_csv(
            input_file
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to load engineered dataset: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Check target column
    # --------------------------------------------------

    if "isFraud" not in df.columns:

        raise HTTPException(
            status_code=400,
            detail="Target column 'isFraud' not found."
        )

    # --------------------------------------------------
    # Split features and target
    # --------------------------------------------------

    X = df.drop(
        columns=["isFraud"]
    )

    y = df["isFraud"]

    # --------------------------------------------------
    # Train/Test Split
    # --------------------------------------------------

    try:

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.20,
            random_state=42,
            stratify=y
        )

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unable to split dataset: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Create dataset-specific training folder
    # --------------------------------------------------

    dataset_training_path = (
        TRAINING_PATH /
        str(dataset.id)
    )

    dataset_training_path.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------
    # Define output files
    # --------------------------------------------------

    X_train_path = (
        dataset_training_path /
        "X_train.csv"
    )

    y_train_path = (
        dataset_training_path /
        "y_train.csv"
    )

    X_test_path = (
        dataset_training_path /
        "X_test.csv"
    )

    y_test_path = (
        dataset_training_path /
        "y_test.csv"
    )

    # --------------------------------------------------
    # Save X_train
    # --------------------------------------------------

    X_train.to_csv(
        X_train_path,
        index=False
    )

    # --------------------------------------------------
    # Save y_train
    # --------------------------------------------------

    y_train.to_csv(
        y_train_path,
        index=False
    )

    # --------------------------------------------------
    # Save X_test
    # --------------------------------------------------

    X_test.to_csv(
        X_test_path,
        index=False
    )

    # --------------------------------------------------
    # Save y_test
    # --------------------------------------------------

    y_test.to_csv(
        y_test_path,
        index=False
    )

    # --------------------------------------------------
    # Verify files were created
    # --------------------------------------------------

    required_files = [
        X_train_path,
        y_train_path,
        X_test_path,
        y_test_path
    ]

    for file_path in required_files:

        if not file_path.exists():

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Failed to create "
                    f"{file_path.name}"
                )
            )

    # --------------------------------------------------
    # Verify row counts
    # --------------------------------------------------

    if len(X_train) != len(y_train):

        raise HTTPException(
            status_code=500,
            detail=(
                "Generated X_train and y_train "
                "row counts do not match."
            )
        )

    if len(X_test) != len(y_test):

        raise HTTPException(
            status_code=500,
            detail=(
                "Generated X_test and y_test "
                "row counts do not match."
            )
        )

    # --------------------------------------------------
    # Display information
    # --------------------------------------------------

    print("\n========================================")
    print("TRAINING DATASET CREATED")
    print("========================================")
    print("Dataset ID:", dataset.id)
    print("X_train rows:", len(X_train))
    print("y_train rows:", len(y_train))
    print("X_test rows:", len(X_test))
    print("y_test rows:", len(y_test))
    print("Features:", len(X.columns))
    print(
        "Output folder:",
        dataset_training_path
    )
    print("========================================\n")

    # --------------------------------------------------
    # Save report
    # --------------------------------------------------

    report = TrainingReport(

        dataset_id=dataset.id,

        training_rows=len(X_train),

        testing_rows=len(X_test),

        total_features=len(X.columns),

        output_folder=str(
            dataset_training_path
        ),

        status="Completed"
    )

    db.add(report)

    db.commit()

    db.refresh(report)

    # --------------------------------------------------
    # Return response
    # --------------------------------------------------

    return {

        "dataset_id": str(
            dataset.id
        ),

        "training_rows": len(
            X_train
        ),

        "testing_rows": len(
            X_test
        ),

        "total_features": len(
            X.columns
        ),

        "output_folder": str(
            dataset_training_path
        ),

        "files": {

            "X_train": "X_train.csv",

            "y_train": "y_train.csv",

            "X_test": "X_test.csv",

            "y_test": "y_test.csv"
        },

        "status": "Completed"
    }