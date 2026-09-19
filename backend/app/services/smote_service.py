from pathlib import Path

import pandas as pd
from fastapi import HTTPException
from imblearn.over_sampling import SMOTE
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.smote_report import SMOTEReport


PREPROCESSED_PATH = Path("storage/preprocessed")
BALANCED_PATH = Path("storage/balanced")

TARGET_COLUMN = "isFraud"

# 0.5 means the minority class will become 50%
# of the majority-class size after SMOTE.
SMOTE_SAMPLING_STRATEGY = 0.5


def apply_smote(dataset_id, db: Session):

    # -----------------------------------------
    # Create output folder
    # -----------------------------------------

    BALANCED_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    # -----------------------------------------
    # Find dataset
    # -----------------------------------------

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

    # -----------------------------------------
    # Input files
    # -----------------------------------------

    train_input_file = (
        PREPROCESSED_PATH
        / f"{dataset.dataset_name}_train_preprocessed.csv"
    )

    test_input_file = (
        PREPROCESSED_PATH
        / f"{dataset.dataset_name}_test_preprocessed.csv"
    )

    if not train_input_file.exists():

        raise HTTPException(
            status_code=404,
            detail=(
                "Preprocessed training dataset not found. "
                "Run preprocessing first."
            )
        )

    if not test_input_file.exists():

        raise HTTPException(
            status_code=404,
            detail=(
                "Preprocessed testing dataset not found. "
                "Run preprocessing first."
            )
        )

    # -----------------------------------------
    # Load training data
    # -----------------------------------------

    try:

        train_df = pd.read_csv(
            train_input_file
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to read preprocessed "
                f"training dataset: {str(exc)}"
            )
        )

    # -----------------------------------------
    # Load testing data
    # -----------------------------------------

    try:

        test_df = pd.read_csv(
            test_input_file
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to read preprocessed "
                f"testing dataset: {str(exc)}"
            )
        )

    # -----------------------------------------
    # Check target column
    # -----------------------------------------

    if TARGET_COLUMN not in train_df.columns:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Target column '{TARGET_COLUMN}' "
                "not found in training dataset."
            )
        )

    if TARGET_COLUMN not in test_df.columns:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Target column '{TARGET_COLUMN}' "
                "not found in testing dataset."
            )
        )

    # -----------------------------------------
    # Separate training features and target
    # -----------------------------------------

    X_train = train_df.drop(
        columns=[TARGET_COLUMN]
    )

    y_train = train_df[
        TARGET_COLUMN
    ]

    # -----------------------------------------
    # Separate testing features and target
    # -----------------------------------------
    # IMPORTANT:
    # Testing data is NEVER passed through SMOTE.
    # It remains in its natural class distribution.

    X_test = test_df.drop(
        columns=[TARGET_COLUMN]
    )

    y_test = test_df[
        TARGET_COLUMN
    ]

    # -----------------------------------------
    # Validate target values
    # -----------------------------------------

    train_classes = set(
        y_train.dropna().unique()
    )

    test_classes = set(
        y_test.dropna().unique()
    )

    if not train_classes.issubset({0, 1}):

        raise HTTPException(
            status_code=400,
            detail=(
                "Training target must contain "
                "only 0 and 1."
            )
        )

    if not test_classes.issubset({0, 1}):

        raise HTTPException(
            status_code=400,
            detail=(
                "Testing target must contain "
                "only 0 and 1."
            )
        )

    # -----------------------------------------
    # Original training statistics
    # -----------------------------------------

    train_rows_before = len(X_train)

    fraud_before = int(
        (y_train == 1).sum()
    )

    legitimate_before = int(
        (y_train == 0).sum()
    )

    # -----------------------------------------
    # Check class distribution
    # -----------------------------------------

    class_counts = (
        y_train.value_counts()
    )

    if len(class_counts) < 2:

        raise HTTPException(
            status_code=400,
            detail=(
                "Training dataset contains "
                "only one class. SMOTE cannot "
                "be applied."
            )
        )

    minority_samples = int(
        class_counts.min()
    )

    if minority_samples < 2:

        raise HTTPException(
            status_code=400,
            detail=(
                "Not enough minority samples "
                "to apply SMOTE."
            )
        )

    # -----------------------------------------
    # Dynamically choose k_neighbors
    # -----------------------------------------

    k_neighbors = min(
        5,
        minority_samples - 1
    )

    # -----------------------------------------
    # Create SMOTE
    # -----------------------------------------

    smote = SMOTE(
        sampling_strategy=SMOTE_SAMPLING_STRATEGY,
        random_state=42,
        k_neighbors=k_neighbors
    )

    # -----------------------------------------
    # Apply SMOTE ONLY to training data
    # -----------------------------------------

    try:

        X_train_balanced, y_train_balanced = (
            smote.fit_resample(
                X_train,
                y_train
            )
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"SMOTE processing failed: "
                f"{str(exc)}"
            )
        )

    # -----------------------------------------
    # Create balanced training dataframe
    # -----------------------------------------

    balanced_train_df = (
        X_train_balanced.copy()
    )

    balanced_train_df[
        TARGET_COLUMN
    ] = y_train_balanced

    # -----------------------------------------
    # Balanced statistics
    # -----------------------------------------

    train_rows_after = len(
        balanced_train_df
    )

    fraud_after = int(
        (y_train_balanced == 1).sum()
    )

    legitimate_after = int(
        (y_train_balanced == 0).sum()
    )

    # -----------------------------------------
    # Testing statistics
    # -----------------------------------------

    test_rows = len(X_test)

    test_fraud = int(
        (y_test == 1).sum()
    )

    test_legitimate = int(
        (y_test == 0).sum()
    )

    # -----------------------------------------
    # Save balanced training data
    # -----------------------------------------

    train_output_file = (
        BALANCED_PATH
        / f"{dataset.dataset_name}_train_balanced.csv"
    )

    test_output_file = (
        BALANCED_PATH
        / f"{dataset.dataset_name}_test.csv"
    )

    try:

        balanced_train_df.to_csv(
            train_output_file,
            index=False
        )

        # Save test data WITHOUT modification.
        test_df.to_csv(
            test_output_file,
            index=False
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save SMOTE datasets: "
                f"{str(exc)}"
            )
        )

    # -----------------------------------------
    # Save SMOTE report
    # -----------------------------------------

    report = SMOTEReport(
        dataset_id=dataset.id,
        rows_before=train_rows_before,
        rows_after=train_rows_after,
        fraud_before=fraud_before,
        fraud_after=fraud_after,
        output_file=str(train_output_file),
        status="Completed",
    )

    db.add(report)

    db.commit()

    db.refresh(report)

    # -----------------------------------------
    # Return result
    # -----------------------------------------

    return {
        "dataset_id": str(dataset.id),

        "training_rows_before":
            train_rows_before,

        "training_rows_after":
            train_rows_after,

        "fraud_before":
            fraud_before,

        "fraud_after":
            fraud_after,

        "legitimate_before":
            legitimate_before,

        "legitimate_after":
            legitimate_after,

        "test_rows":
            test_rows,

        "test_fraud":
            test_fraud,

        "test_legitimate":
            test_legitimate,

        "sampling_strategy":
            SMOTE_SAMPLING_STRATEGY,

        "k_neighbors":
            k_neighbors,

        "balanced_training_file":
            train_output_file.name,

        "untouched_test_file":
            test_output_file.name,

        "status":
            "Completed"
    }