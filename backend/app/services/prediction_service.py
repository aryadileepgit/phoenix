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

def predict_transactions_batch(
    dataset_id,
    df: pd.DataFrame,
    db: Session
):

    dataset, model, encoders, scaler, dataset_preprocessing_path = (
        _load_model_artifacts(dataset_id, db)
    )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded CSV file contains no rows."
        )

    # Keep the raw, un-encoded values for persistence — the
    # DataFrame passed into _prepare_input_features gets mutated
    # (categorical columns get label-encoded in place).
    raw_records = df.to_dict(orient="records")

    prepared = _prepare_input_features(
        df.copy(),
        model,
        encoders,
        scaler,
        dataset_preprocessing_path
    )

    try:
        predictions = model.predict(prepared)
        probabilities = model.predict_proba(prepared)[:, 1]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Batch prediction failed: {str(e)}"
            )
        )

    results = []
    saved_transactions = []

    for i, record in enumerate(raw_records):

        predicted_label = bool(int(predictions[i]))
        fraud_probability = round(float(probabilities[i]), 4)
        legitimate_probability = round(float(1 - probabilities[i]), 4)

        actual_label_value = None
        if "isFraud" in record and pd.notna(record.get("isFraud")):
            actual_label_value = bool(record["isFraud"])

        sender_name = None
        if "nameOrig" in record and pd.notna(record.get("nameOrig")):
            sender_name = str(record["nameOrig"])

        receiver_name = None
        if "nameDest" in record and pd.notna(record.get("nameDest")):
            receiver_name = str(record["nameDest"])

        transaction = Transaction(
            dataset_id=dataset.id,
            step=int(record["step"]),
            transaction_type=str(record["type"]),
            amount=float(record["amount"]),
            sender=sender_name,
            sender_balance_before=float(record["oldbalanceOrg"]),
            sender_balance_after=float(record["newbalanceOrig"]),
            receiver=receiver_name,
            receiver_balance_before=float(record["oldbalanceDest"]),
            receiver_balance_after=float(record["newbalanceDest"]),
            actual_label=actual_label_value,
            predicted_label=predicted_label,
            fraud_probability=fraud_probability,
        )

        db.add(transaction)
        saved_transactions.append(transaction)

        results.append({
            "transaction_id": None,  # filled in after commit
            "type": str(record["type"]),
            "amount": float(record["amount"]),
            "predicted_label": int(predictions[i]),
            "result": "Fraud" if predicted_label else "Legitimate",
            "fraud_probability": fraud_probability,
            "legitimate_probability": legitimate_probability,
        })

    db.commit()

    for i, transaction in enumerate(saved_transactions):
        db.refresh(transaction)
        results[i]["transaction_id"] = str(transaction.id)
        results[i]["created_at"] = transaction.created_at

    total_transactions = len(results)
    fraud_count = int(sum(predictions))
    legitimate_count = total_transactions - fraud_count
    fraud_rate = (
        round((fraud_count / total_transactions) * 100, 2)
        if total_transactions else 0.0
    )

    return {
        "dataset_id": str(dataset.id),
        "dataset_name": dataset.dataset_name,
        "model": "XGBoost",
        "summary": {
            "total_transactions": total_transactions,
            "fraud_count": fraud_count,
            "legitimate_count": legitimate_count,
            "fraud_rate": fraud_rate,
        },
        "results": results,
    }
