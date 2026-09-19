from pathlib import Path

import pandas as pd

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.dataset_cleaning import DatasetCleaning


RAW_PATH = Path("storage/raw")
IEEE_CIS_PATH = RAW_PATH / "ieee_cis"
PROCESSED_PATH = Path("storage/processed")

TARGET_COLUMN = "isFraud"
JOIN_COLUMN = "TransactionID"


def find_raw_file(filename):
    """
    Look for the dataset first in the normal raw folder,
    then inside the IEEE-CIS folder.
    """

    normal_path = RAW_PATH / filename

    if normal_path.exists():
        return normal_path

    ieee_path = IEEE_CIS_PATH / filename

    if ieee_path.exists():
        return ieee_path

    return None


def clean_dataset(dataset_id, db: Session):

    # ==================================================
    # CREATE OUTPUT FOLDER
    # ==================================================

    PROCESSED_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    # ==================================================
    # FIND DATASET
    # ==================================================

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id
    ).first()

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    # ==================================================
    # ONLY TRAIN DATA IS USED FOR SUPERVISED PIPELINE
    # ==================================================

    if dataset.original_filename != "train_transaction.csv":

        raise HTTPException(
            status_code=400,
            detail=(
                "Phoenix supervised training pipeline requires "
                "train_transaction.csv because it contains the "
                "isFraud target column."
            )
        )

    # ==================================================
    # FIND TRANSACTION FILE
    # ==================================================

    transaction_file = find_raw_file(
        dataset.original_filename
    )

    if transaction_file is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Transaction dataset file "
                f"'{dataset.original_filename}' not found."
            )
        )

    # ==================================================
    # LOAD TRANSACTION DATA
    # ==================================================

    try:

        transactions = pd.read_csv(
            transaction_file
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to load transaction dataset: {str(e)}"
            )
        )

    # ==================================================
    # VALIDATE REQUIRED COLUMNS
    # ==================================================

    required_columns = [
        JOIN_COLUMN,
        TARGET_COLUMN,
        "TransactionAmt",
        "TransactionDT"
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in transactions.columns
    ]

    if missing_columns:

        raise HTTPException(
            status_code=400,
            detail=(
                "Required columns missing from transaction dataset: "
                + ", ".join(missing_columns)
            )
        )

    # ==================================================
    # BASIC DATASET INFORMATION
    # ==================================================

    rows_before = len(transactions)

    transaction_duplicates = int(
        transactions[JOIN_COLUMN]
        .duplicated()
        .sum()
    )

    if transaction_duplicates > 0:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Transaction dataset contains "
                f"{transaction_duplicates} duplicate "
                f"TransactionID values."
            )
        )

    # ==================================================
    # FIND IDENTITY DATASET
    # ==================================================

    identity_filename = "train_identity.csv"

    identity_file = find_raw_file(
        identity_filename
    )

    identity_rows = 0
    identity_duplicates_removed = 0

    # ==================================================
    # MERGE IDENTITY INFORMATION
    # ==================================================

    if identity_file is not None:

        try:

            identity = pd.read_csv(
                identity_file
            )

        except Exception as e:

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Unable to load identity dataset: {str(e)}"
                )
            )

        # --------------------------------------------------
        # Validate identity join column
        # --------------------------------------------------

        if JOIN_COLUMN not in identity.columns:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Required column '{JOIN_COLUMN}' "
                    "not found in identity dataset."
                )
            )

        # --------------------------------------------------
        # Check duplicate identity IDs
        # --------------------------------------------------

        identity_duplicates = int(
            identity[JOIN_COLUMN]
            .duplicated()
            .sum()
        )

        if identity_duplicates > 0:

            identity_duplicates_removed = (
                identity_duplicates
            )

            identity = identity.drop_duplicates(
                subset=[JOIN_COLUMN],
                keep="first"
            )

        identity_rows = len(identity)

        # --------------------------------------------------
        # LEFT JOIN
        #
        # Important:
        # Keep ALL transaction records.
        # Identity information is available only for
        # a subset of IEEE-CIS transactions.
        # --------------------------------------------------

        transactions = transactions.merge(
            identity,
            on=JOIN_COLUMN,
            how="left",
            suffixes=("", "_identity"),
            validate="one_to_one"
        )

    # ==================================================
    # VERIFY TRANSACTION COUNT AFTER JOIN
    # ==================================================

    rows_after_identity_join = len(
        transactions
    )

    if rows_after_identity_join != rows_before:

        raise HTTPException(
            status_code=500,
            detail=(
                "Identity merge changed the transaction row count. "
                "This indicates a join problem."
            )
        )

    # ==================================================
    # REMOVE EXACT DUPLICATE ROWS
    # ==================================================

    duplicate_rows = int(
        transactions.duplicated().sum()
    )

    if duplicate_rows > 0:

        transactions = transactions.drop_duplicates()

    rows_after = len(
        transactions
    )

    # ==================================================
    # CALCULATE MISSING VALUES
    #
    # IMPORTANT:
    # DO NOT IMPUTE HERE.
    #
    # IEEE-CIS is intentionally sparse.
    # Missing-value handling is performed later
    # during preprocessing.
    # ==================================================

    missing_values = int(
        transactions.isnull()
        .sum()
        .sum()
    )

    # ==================================================
    # VALIDATE TARGET
    # ==================================================

    invalid_target_mask = (
        ~transactions[TARGET_COLUMN]
        .isin([0, 1])
    )

    invalid_target_values = int(
        invalid_target_mask.sum()
    )

    if invalid_target_values > 0:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Target column contains "
                f"{invalid_target_values} invalid values. "
                "Only 0 and 1 are allowed."
            )
        )

    # ==================================================
    # CHECK TARGET DISTRIBUTION
    # ==================================================

    fraud_count = int(
        (transactions[TARGET_COLUMN] == 1).sum()
    )

    legitimate_count = int(
        (transactions[TARGET_COLUMN] == 0).sum()
    )

    # ==================================================
    # SAVE CLEANED DATASET
    # ==================================================

    cleaned_filename = (
        f"{dataset.dataset_name}_clean.csv"
    )

    cleaned_path = (
        PROCESSED_PATH /
        cleaned_filename
    )

    try:

        transactions.to_csv(
            cleaned_path,
            index=False
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to save cleaned dataset: {str(e)}"
            )
        )

    # ==================================================
    # SAVE CLEANING REPORT
    # ==================================================

    report = DatasetCleaning(

        dataset_id=dataset.id,

        rows_before=rows_before,

        rows_after=rows_after,

        duplicates_removed=duplicate_rows,

        # No missing values are filled at this stage.
        missing_values_fixed=0,

        cleaned_file=str(
            cleaned_path
        ),

        status="Completed"
    )

    db.add(report)

    db.commit()

    db.refresh(report)

    # ==================================================
    # DISPLAY
    # ==================================================

    print("\n========================================")
    print("IEEE-CIS CLEANING COMPLETED")
    print("========================================")

    print(
        "Dataset ID:",
        dataset.id
    )

    print(
        "Transaction file:",
        transaction_file
    )

    print(
        "Transaction rows:",
        rows_before
    )

    print(
        "Rows after identity join:",
        rows_after_identity_join
    )

    print(
        "Rows after cleaning:",
        rows_after
    )

    print(
        "Identity file:",
        identity_file
        if identity_file is not None
        else "Not found"
    )

    print(
        "Identity rows:",
        identity_rows
    )

    print(
        "Identity duplicates removed:",
        identity_duplicates_removed
    )

    print(
        "Exact duplicate rows removed:",
        duplicate_rows
    )

    print(
        "Fraud transactions:",
        fraud_count
    )

    print(
        "Legitimate transactions:",
        legitimate_count
    )

    print(
        "Missing values preserved:",
        missing_values
    )

    print(
        "Target column:",
        TARGET_COLUMN
    )

    print(
        "Cleaned dataset:",
        cleaned_path
    )

    print("========================================\n")

    # ==================================================
    # RETURN
    # ==================================================

    return {

        "dataset_id": str(
            dataset.id
        ),

        "rows_before": rows_before,

        "rows_after_identity_join": (
            rows_after_identity_join
        ),

        "rows_after": rows_after,

        "duplicates_removed": duplicate_rows,

        "missing_values_fixed": 0,

        "missing_values_preserved": missing_values,

        "identity_dataset_used": (
            identity_file.name
            if identity_file is not None
            else None
        ),

        "identity_rows": identity_rows,

        "identity_duplicates_removed": (
            identity_duplicates_removed
        ),

        "fraud_transactions": fraud_count,

        "legitimate_transactions": legitimate_count,

        "target_column": TARGET_COLUMN,

        "cleaned_file": cleaned_filename,

        "status": "Completed"
    }