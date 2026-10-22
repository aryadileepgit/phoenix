from pathlib import Path

import joblib
import pandas as pd

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.transaction import Transaction


MODEL_PATH = Path("storage/models")
PREPROCESSING_MODEL_PATH = Path("storage/preprocessing_models")

ORIGINAL_REQUIRED_COLUMNS = [
    "step",
    "type",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "isFlaggedFraud",
]


# ======================================================
# Shared: load the trained model + preprocessing artifacts
# ======================================================
#
# Used by both the single-transaction and batch prediction paths so
# there is exactly one implementation of "how PHOENIX loads a
# dataset's trained model", not two.

def _load_model_artifacts(dataset_id, db: Session):

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id
    ).first()

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    dataset_model_path = (
        MODEL_PATH / str(dataset.id)
    )

    dataset_preprocessing_path = (
        PREPROCESSING_MODEL_PATH / str(dataset.id)
    )

    model_file_path = (
        dataset_model_path / "xgboost.joblib"
    )

    encoder_file_path = (
        dataset_preprocessing_path / "encoders.joblib"
    )

    scaler_file_path = (
        dataset_preprocessing_path / "scaler.joblib"
    )

    if not model_file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Trained XGBoost model not found."
        )

    if not encoder_file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Preprocessing encoders not found."
        )

    if not scaler_file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Preprocessing scaler not found."
        )

    try:
        model = joblib.load(model_file_path)
        encoders = joblib.load(encoder_file_path)
        scaler = joblib.load(scaler_file_path)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to load model or preprocessing "
                f"artifacts: {str(e)}"
            )
        )

    return dataset, model, encoders, scaler, dataset_preprocessing_path


# ======================================================
# Shared: turn raw transaction rows into model-ready features
# ======================================================
#
# Same feature handling, categorical encoding, scaling, and feature
# engineering for both a single transaction (1-row DataFrame) and a
# batch (N-row DataFrame).

def _prepare_input_features(
    input_data: pd.DataFrame,
    model,
    encoders,
    scaler,
    dataset_preprocessing_path: Path,
) -> pd.DataFrame:

    # --------------------------------------------------
    # Check original input columns
    # --------------------------------------------------

    missing_columns = [
        column
        for column in ORIGINAL_REQUIRED_COLUMNS
        if column not in input_data.columns
    ]

    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing transaction fields.",
                "missing_fields": missing_columns
            }
        )

    # --------------------------------------------------
    # Encode categorical columns (vectorized — works for
    # both a single row and a batch of N rows)
    # --------------------------------------------------

    try:
        for column, encoder in encoders.items():

            if column not in input_data.columns:
                continue

            str_values = input_data[column].astype(str)
            unknown_mask = ~str_values.isin(encoder.classes_)

            if unknown_mask.any():
                unknown_values = sorted(set(str_values[unknown_mask].tolist()))

                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": (
                            f"Unknown value(s) for "
                            f"column '{column}'."
                        ),
                        "values": unknown_values
                    }
                )

            input_data[column] = encoder.transform(str_values)

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Categorical encoding failed: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Create engineered features
    # --------------------------------------------------

    input_data["origin_balance_change"] = (
        input_data["oldbalanceOrg"]
        - input_data["newbalanceOrig"]
    )

    input_data["destination_balance_change"] = (
        input_data["newbalanceDest"]
        - input_data["oldbalanceDest"]
    )

    input_data["balance_difference"] = (
        input_data["origin_balance_change"]
        - input_data["destination_balance_change"]
    ).abs()

    input_data["amount_to_origin_ratio"] = (
        input_data["amount"]
        / (input_data["oldbalanceOrg"] + 1)
    )

    # --------------------------------------------------
    # Large transaction flag
    # --------------------------------------------------

    median_amount_file = (
        dataset_preprocessing_path / "median_amount.joblib"
    )

    if median_amount_file.exists():
        median_amount = joblib.load(median_amount_file)

    else:
        # Fallback: no stored training median available yet,
        # so fall back to the median of the current input.
        median_amount = input_data["amount"].median()

    input_data["is_large_transaction"] = (
        input_data["amount"] > median_amount
    ).astype(int)

    # --------------------------------------------------
    # Scale numeric columns
    # --------------------------------------------------

    try:
        numeric_columns = (
            input_data.select_dtypes(
                include=["int64", "float64"]
            ).columns
        )

        scaler_columns = list(
            getattr(
                scaler,
                "feature_names_in_",
                numeric_columns
            )
        )

        available_scaler_columns = [
            column
            for column in scaler_columns
            if column in input_data.columns
        ]

        if available_scaler_columns:
            input_data[available_scaler_columns] = scaler.transform(
                input_data[available_scaler_columns]
            )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Numerical scaling failed: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Arrange features exactly as the model expects
    # --------------------------------------------------

    expected_features = list(model.feature_names_in_)

    missing_model_features = [
        feature
        for feature in expected_features
        if feature not in input_data.columns
    ]

    if missing_model_features:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "Unable to create all features "
                    "required by the model."
                ),
                "missing_features": missing_model_features
            }
        )

    return input_data[expected_features]


# ======================================================
# SINGLE TRANSACTION PREDICTION
# ======================================================

def predict_transaction(
    dataset_id,
    transaction_data,
    db: Session
):

    dataset, model, encoders, scaler, dataset_preprocessing_path = (
        _load_model_artifacts(dataset_id, db)
    )

    try:
        input_data = pd.DataFrame([transaction_data])

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid transaction data: {str(e)}"
            )
        )

    prepared = _prepare_input_features(
        input_data,
        model,
        encoders,
        scaler,
        dataset_preprocessing_path
    )

    try:
        prediction = model.predict(prepared)[0]
        probability = model.predict_proba(prepared)[0][1]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Prediction failed: {str(e)}"
            )
        )

    result = "Fraud" if prediction == 1 else "Legitimate"

    return {
        "dataset_id": str(dataset.id),
        "dataset_name": dataset.dataset_name,
        "model": "XGBoost",
        "prediction": int(prediction),
        "result": result,
        "fraud_probability": round(float(probability), 4),
        "legitimate_probability": round(float(1 - probability), 4),
        "status": "Completed"
    }


# ======================================================
# BATCH (CSV) TRANSACTION PREDICTION
# ======================================================
#
# Reuses the exact same _load_model_artifacts / _prepare_input_features
# pipeline as the single-transaction path above, then persists every
# analyzed transaction + its prediction so the Transactions page has
# real data to show.

BATCH_ROW_LIMIT = 5000


def _parse_json_cell(value):
    """CSV dict columns arrive as JSON strings; pass dicts through."""

    import json

    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        try:
            parsed = json.loads(text)
        except ValueError:
            return None

        return parsed if isinstance(parsed, dict) else None

    return None


def predict_transactions_batch(
    dataset_id,
    df: pd.DataFrame,
    db: Session
):
    """
    Score a CSV of transactions through the live IEEE-CIS pipeline.

    Each row goes through the exact same path as POST
    /transactions/score (schema-evolution normalize, TransactionCreate
    validation, FraudScoringService, persist). One bad row fails only
    itself via SAVEPOINT, never the whole batch.
    """

    from pydantic import ValidationError

    from app.schemas.transaction import TransactionCreate
    from app.services.model_scoring_service import (
        fraud_scoring_service,
    )
    from app.services.schema_evolution_service import (
        schema_evolution_service,
    )

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id
    ).first()

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded CSV file contains no rows."
        )

    if len(df) > BATCH_ROW_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Batch limited to {BATCH_ROW_LIMIT} rows, "
                f"got {len(df)}."
            ),
        )

    results = []
    scored = 0
    failed = 0

    for index, record in enumerate(
        df.to_dict(orient="records")
    ):
        row = {
            key: (None if pd.isna(value) else value)
            for key, value in record.items()
        }

        for field in (
            "card_information",
            "device_information",
            "additional_data",
        ):
            if field in row:
                row[field] = _parse_json_cell(row[field])

        try:
            evolution_result = (
                schema_evolution_service.normalize_transaction(
                    row
                )
            )

            if evolution_result["unmapped_fields"]:
                raise ValueError(
                    "Unmapped fields: "
                    + ", ".join(
                        sorted(
                            evolution_result["unmapped_fields"]
                        )
                    )
                )

            transaction = TransactionCreate.model_validate(
                evolution_result["canonical_transaction"]
            )

            transaction_data = transaction.model_dump()

            scoring_result = fraud_scoring_service.score(
                transaction_data
            )

            savepoint = db.begin_nested()

            try:
                new_transaction = Transaction(
                    transaction_id=transaction.transaction_id,
                    account_id=transaction.account_id,
                    amount=transaction.amount,
                    transaction_time=transaction.transaction_time,
                    product_code=transaction.product_code,
                    card_information=transaction.card_information,
                    device_information=transaction.device_information,
                    additional_data=transaction.additional_data,
                    fraud_probability=scoring_result[
                        "fraud_probability"
                    ],
                    predicted_label=scoring_result[
                        "predicted_label"
                    ],
                    risk_level=scoring_result["risk_level"],
                    decision=scoring_result["decision"],
                )

                db.add(new_transaction)
                db.flush()
            except Exception:
                savepoint.rollback()
                raise

            scored += 1

            results.append(
                {
                    "row": index,
                    "transaction_id": transaction.transaction_id,
                    "status": "scored",
                    "fraud_probability": scoring_result[
                        "fraud_probability"
                    ],
                    "risk_level": scoring_result["risk_level"],
                    "decision": scoring_result["decision"],
                    "scoring_latency_ms": scoring_result.get(
                        "scoring_latency_ms"
                    ),
                }
            )

        except (ValidationError, ValueError) as e:
            failed += 1

            results.append(
                {
                    "row": index,
                    "status": "failed",
                    "error": str(e)[:300],
                }
            )

        except Exception as e:
            failed += 1

            try:
                db.rollback()
            except Exception:
                pass

            results.append(
                {
                    "row": index,
                    "status": "failed",
                    "error": str(e)[:300],
                }
            )

    try:
        db.commit()
    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Batch persist failed: {str(e)}",
        )

    return {
        "total_rows": len(df),
        "scored": scored,
        "failed": failed,
        "results": results,
    }
