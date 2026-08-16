from pathlib import Path

import joblib
import pandas as pd

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset


MODEL_PATH = Path("storage/models")
PREPROCESSING_MODEL_PATH = Path("storage/preprocessing_models")


def predict_transaction(
    dataset_id,
    transaction_data,
    db: Session
):

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
    # Dataset-specific paths
    # --------------------------------------------------

    dataset_model_path = (
        MODEL_PATH /
        str(dataset.id)
    )

    dataset_preprocessing_path = (
        PREPROCESSING_MODEL_PATH /
        str(dataset.id)
    )

    model_file_path = (
        dataset_model_path /
        "xgboost.joblib"
    )

    encoder_file_path = (
        dataset_preprocessing_path /
        "encoders.joblib"
    )

    scaler_file_path = (
        dataset_preprocessing_path /
        "scaler.joblib"
    )

    # --------------------------------------------------
    # Check model
    # --------------------------------------------------

    if not model_file_path.exists():

        raise HTTPException(
            status_code=404,
            detail="Trained XGBoost model not found."
        )

    # --------------------------------------------------
    # Check preprocessing artifacts
    # --------------------------------------------------

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

    # --------------------------------------------------
    # Load model
    # --------------------------------------------------

    try:

        model = joblib.load(
            model_file_path
        )

        encoders = joblib.load(
            encoder_file_path
        )

        scaler = joblib.load(
            scaler_file_path
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to load model or preprocessing "
                f"artifacts: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Create input DataFrame
    # --------------------------------------------------

    try:

        input_data = pd.DataFrame(
            [transaction_data]
        )

    except Exception as e:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid transaction data: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Get expected original columns
    # --------------------------------------------------

    expected_features = list(
        model.feature_names_in_
    )

    # --------------------------------------------------
    # Check original input columns
    # --------------------------------------------------

    original_required_columns = [
    "step",
    "type",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "isFlaggedFraud"
]

    missing_columns = [
        column
        for column in original_required_columns
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
    # Encode categorical columns
    # --------------------------------------------------

    try:

        for column, encoder in encoders.items():

            if column not in input_data.columns:
                continue

            value = str(
                input_data.at[0, column]
            )

            # Check whether the value existed
            # during training.

            if value not in encoder.classes_:

                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": (
                            f"Unknown value for "
                            f"column '{column}'."
                        ),
                        "value": value
                    }
                )

            input_data[column] = encoder.transform(
                input_data[column].astype(str)
            )

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

    # The model was trained using a median calculated
    # from the dataset. Therefore, use the median
    # stored during training if available.

    median_amount_file = (
        dataset_preprocessing_path /
        "median_amount.joblib"
    )

    if median_amount_file.exists():

        median_amount = joblib.load(
            median_amount_file
        )

    else:

        # Fallback for the currently trained model.
        # We will save this value properly when the
        # preprocessing/feature-engineering pipeline
        # is finalized.

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

        # Only scale columns that were originally
        # supplied to the scaler during training.

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

            input_data[
                available_scaler_columns
            ] = scaler.transform(
                input_data[
                    available_scaler_columns
                ]
            )

    except Exception as e:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Numerical scaling failed: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Arrange features exactly as model expects
    # --------------------------------------------------

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

    input_data = input_data[
        expected_features
    ]

    # --------------------------------------------------
    # Make Prediction
    # --------------------------------------------------

    try:

        prediction = model.predict(
            input_data
        )[0]

        probability = model.predict_proba(
            input_data
        )[0][1]

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Prediction failed: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Determine Result
    # --------------------------------------------------

    if prediction == 1:

        result = "Fraud"

    else:

        result = "Legitimate"

    # --------------------------------------------------
    # Return Prediction
    # --------------------------------------------------

    return {

        "dataset_id": str(
            dataset.id
        ),

        "dataset_name": (
            dataset.dataset_name
        ),

        "model": "XGBoost",

        "prediction": int(
            prediction
        ),

        "result": result,

        "fraud_probability": round(
            float(probability),
            4
        ),

        "legitimate_probability": round(
            float(1 - probability),
            4
        ),

        "status": "Completed"
    }