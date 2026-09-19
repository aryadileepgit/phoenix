from pathlib import Path

import numpy as np
import pandas as pd

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.feature_engineering_report import FeatureEngineeringReport


PROCESSED_PATH = Path("storage/processed")
ENGINEERED_PATH = Path("storage/engineered")

TARGET_COLUMN = "isFraud"


def find_column(df, column_name):
    """
    Finds the exact IEEE-CIS column or a prefixed version of it.
    """
    if column_name in df.columns:
        return column_name

    matching_columns = [
        column
        for column in df.columns
        if column.endswith(f"__{column_name}")
    ]

    return matching_columns[0] if matching_columns else None


def find_columns_by_prefix(df, prefix):
    """
    Finds columns that start with a prefix or contain the
    prefix after a schema namespace.
    """
    return [
        column
        for column in df.columns
        if column.startswith(prefix)
        or f"__{prefix}" in column
    ]


def feature_engineering(dataset_id, db: Session):

    # --------------------------------------------------
    # Create output folder
    # --------------------------------------------------

    ENGINEERED_PATH.mkdir(
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
    # Load cleaned dataset
    # --------------------------------------------------

    input_file = (
        PROCESSED_PATH /
        f"{dataset.dataset_name}_clean.csv"
    )

    if not input_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Cleaned dataset not found. Run cleaning first."
        )

    try:
        df = pd.read_csv(input_file)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to load cleaned dataset: {str(e)}"
        )

    # --------------------------------------------------
    # Validate target
    # --------------------------------------------------

    if TARGET_COLUMN not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Target column '{TARGET_COLUMN}' "
                "not found in cleaned dataset."
            )
        )

    target_values = set(
        df[TARGET_COLUMN].dropna().unique()
    )

    if not target_values.issubset({0, 1}):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Target column '{TARGET_COLUMN}' "
                "must contain only 0 and 1."
            )
        )

    original_features = len(df.columns)

    new_features = []

    # ==================================================
    # 1. TRANSACTION AMOUNT FEATURES
    # ==================================================

    amount_column = find_column(
        df,
        "TransactionAmt"
    )

    if amount_column is not None:

        df["transaction_amount_log"] = np.log1p(
            df[amount_column].clip(lower=0)
        )

        new_features.append(
            "transaction_amount_log"
        )

    # ==================================================
    # 2. TRANSACTION TIME FEATURES
    # ==================================================

    transaction_dt_column = find_column(
        df,
        "TransactionDT"
    )

    if transaction_dt_column is not None:

        transaction_seconds = pd.to_numeric(
            df[transaction_dt_column],
            errors="coerce"
        )

        seconds_per_day = 86400

        seconds_in_day = (
            transaction_seconds %
            seconds_per_day
        )

        df["transaction_hour"] = (
            seconds_in_day // 3600
        )

        df["transaction_day"] = (
            transaction_seconds //
            seconds_per_day
        )

        df["is_night_transaction"] = (
            (
                df["transaction_hour"] < 6
            )
            |
            (
                df["transaction_hour"] >= 22
            )
        ).astype(int)

        new_features.extend([
            "transaction_hour",
            "transaction_day",
            "is_night_transaction"
        ])

    # ==================================================
    # 3. EMAIL DOMAIN RELATIONSHIP
    # ==================================================

    p_email_column = find_column(
        df,
        "P_emaildomain"
    )

    r_email_column = find_column(
        df,
        "R_emaildomain"
    )

    if (
        p_email_column is not None
        and r_email_column is not None
    ):

        p_email = df[p_email_column]
        r_email = df[r_email_column]

        both_available = (
            p_email.notna()
            &
            r_email.notna()
        )

        df["email_domain_match"] = (
            both_available
            &
            (
                p_email.astype("string")
                ==
                r_email.astype("string")
            )
        ).astype(int)

        df["email_information_available"] = (
            p_email.notna()
            |
            r_email.notna()
        ).astype(int)

        new_features.extend([
            "email_domain_match",
            "email_information_available"
        ])

    # ==================================================
    # 4. ADDRESS INFORMATION
    # ==================================================

    address_columns = []

    addr1_column = find_column(
        df,
        "addr1"
    )

    addr2_column = find_column(
        df,
        "addr2"
    )

    if addr1_column is not None:
        address_columns.append(addr1_column)

    if addr2_column is not None:
        address_columns.append(addr2_column)

    if address_columns:

        df["address_information_available"] = (
            df[address_columns]
            .notna()
            .sum(axis=1)
        )

        new_features.append(
            "address_information_available"
        )

    # ==================================================
    # 5. CARD INFORMATION
    # ==================================================

    card_columns = find_columns_by_prefix(
        df,
        "card"
    )

    if card_columns:

        df["card_information_count"] = (
            df[card_columns]
            .notna()
            .sum(axis=1)
        )

        new_features.append(
            "card_information_count"
        )

    # ==================================================
    # 6. DISTANCE INFORMATION
    # ==================================================

    distance_columns = []

    dist1_column = find_column(
        df,
        "dist1"
    )

    dist2_column = find_column(
        df,
        "dist2"
    )

    if dist1_column is not None:
        distance_columns.append(dist1_column)

    if dist2_column is not None:
        distance_columns.append(dist2_column)

    if distance_columns:

        df["distance_information_available"] = (
            df[distance_columns]
            .notna()
            .sum(axis=1)
        )

        new_features.append(
            "distance_information_available"
        )

    # ==================================================
    # 7. IDENTITY INFORMATION
    # ==================================================

    identity_columns = [
        column
        for column in df.columns
        if (
            column.startswith("id_")
            or "__id_" in column
            or column == "DeviceType"
            or column == "DeviceInfo"
            or "__DeviceType" in column
            or "__DeviceInfo" in column
        )
    ]

    if identity_columns:

        df["identity_information_available"] = (
            df[identity_columns]
            .notna()
            .any(axis=1)
            .astype(int)
        )

        df["identity_information_count"] = (
            df[identity_columns]
            .notna()
            .sum(axis=1)
        )

        new_features.extend([
            "identity_information_available",
            "identity_information_count"
        ])

    # ==================================================
    # 8. DEVICE INFORMATION
    # ==================================================

    device_columns = []

    device_type_column = find_column(
        df,
        "DeviceType"
    )

    device_info_column = find_column(
        df,
        "DeviceInfo"
    )

    if device_type_column is not None:
        device_columns.append(
            device_type_column
        )

    if device_info_column is not None:
        device_columns.append(
            device_info_column
        )

    if device_columns:

        df["device_information_available"] = (
            df[device_columns]
            .notna()
            .any(axis=1)
            .astype(int)
        )

        new_features.append(
            "device_information_available"
        )

    # ==================================================
    # 9. MISSING FEATURE COUNT
    # ==================================================

    feature_columns_before_new_features = [
        column
        for column in df.columns
        if column != TARGET_COLUMN
    ]

    df["missing_feature_count"] = (
        df[feature_columns_before_new_features]
        .isna()
        .sum(axis=1)
    )

    new_features.append(
        "missing_feature_count"
    )

    # ==================================================
    # 10. SAVE ENGINEERED DATASET
    # ==================================================

    engineered_filename = (
        f"{dataset.dataset_name}_engineered.csv"
    )

    output_path = (
        ENGINEERED_PATH /
        engineered_filename
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
                f"Unable to save engineered dataset: {str(e)}"
            )
        )

    engineered_features = len(
        df.columns
    )

    # ==================================================
    # 11. SAVE REPORT
    # ==================================================

    report = FeatureEngineeringReport(

        dataset_id=dataset.id,

        original_features=original_features,

        engineered_features=engineered_features,

        output_file=str(
            output_path
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
    print("IEEE-CIS FEATURE ENGINEERING COMPLETED")
    print("========================================")

    print(
        "Dataset ID:",
        dataset.id
    )

    print(
        "Original features:",
        original_features
    )

    print(
        "Engineered features:",
        engineered_features
    )

    print(
        "New features:",
        new_features
    )

    print(
        "Output:",
        output_path
    )

    print("========================================\n")

    # ==================================================
    # RETURN
    # ==================================================

    return {

        "dataset_id": str(
            dataset.id
        ),

        "original_features": original_features,

        "engineered_features": engineered_features,

        "new_features_created": len(
            new_features
        ),

        "new_features": new_features,

        "output_file": engineered_filename,

        "status": "Completed"
    }