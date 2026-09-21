import os
from typing import Optional

import joblib
import pandas as pd
import shap
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.ml_model import MLModel
from app.models.prediction import Prediction

MODEL_PATH = "storage/models"
PREPROCESSING_MODEL_PATH = "storage/preprocessing_models"


def _load_model_and_preprocessing(dataset_id, db: Session):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    dataset_model_path = os.path.join(MODEL_PATH, str(dataset.id))
    dataset_preprocessing_path = os.path.join(PREPROCESSING_MODEL_PATH, str(dataset.id))

    model_file = os.path.join(dataset_model_path, "xgboost.joblib")
    encoder_file = os.path.join(dataset_preprocessing_path, "encoders.joblib")
    scaler_file = os.path.join(dataset_preprocessing_path, "scaler.joblib")

    for f in [model_file, encoder_file, scaler_file]:
        if not os.path.exists(f):
            raise HTTPException(status_code=404, detail=f"Model artifact not found: {f}")

    try:
        model = joblib.load(model_file)
        encoders = joblib.load(encoder_file)
        scaler = joblib.load(scaler_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load artifacts: {str(e)}")

    return model, encoders, scaler, dataset


def get_shap_explanations(
    dataset_id,
    transaction_data: dict,
    db: Session,
) -> dict:
    model, encoders, scaler, dataset = _load_model_and_preprocessing(dataset_id, db)

    try:
        input_df = pd.DataFrame([transaction_data])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid transaction data: {str(e)}")

    for column, encoder in encoders.items():
        if column in input_df.columns:
            str_values = input_df[column].astype(str)
            input_df[column] = encoder.transform(str_values)

    try:
        numeric_columns = input_df.select_dtypes(include=["int64", "float64"]).columns
        scaler_columns = list(
            getattr(scaler, "feature_names_in_", numeric_columns)
        )
        available_scaler_columns = [
            c for c in scaler_columns if c in input_df.columns
        ]
        if available_scaler_columns:
            input_df[available_scaler_columns] = scaler.transform(
                input_df[available_scaler_columns]
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Scaling failed: {str(e)}")

    try:
        explainer = shap.Explainer(model, input_df)
        shap_values = explainer(input_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHAP computation failed: {str(e)}")

    feature_names = list(input_df.columns)
    shap_values_list = shap_values.values.tolist()[0] if hasattr(shap_values, "values") else []
    if not shap_values_list and len(feature_names) > 0:
        shap_values_list = [0.0] * len(feature_names)

    feature_contributions = []
    for i, fname in enumerate(feature_names):
        if i < len(shap_values_list):
            feature_contributions.append(
                {
                    "feature": fname,
                    "shap_value": round(float(shap_values_list[i]), 6),
                    "abs_shap_value": round(abs(float(shap_values_list[i])), 6),
                }
            )

    feature_contributions.sort(key=lambda x: x["abs_shap_value"], reverse=True)

    global_summary = get_global_shap_summary(dataset_id, db)

    return {
        "dataset_id": str(dataset.id),
        "transaction_id": None,
        "feature_contributions": feature_contributions,
        "global_summary": global_summary,
    }


def get_global_shap_summary(dataset_id, db: Session) -> dict:
    model, encoders, scaler, dataset = _load_model_and_preprocessing(dataset_id, db)

    predictions = db.query(Prediction).filter(Prediction.model_id == dataset_id).all()

    feature_importance = []
    try:
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            feature_names = list(model.feature_names_in_) if hasattr(model, "feature_names_in_") else []
            feature_importance = [
                {"feature": fname, "importance": round(float(imp), 6)}
                for fname, imp in zip(feature_names, importances)
            ]
            feature_importance.sort(key=lambda x: x["importance"], reverse=True)
    except Exception:
        pass

    top_features = feature_importance[:10] if feature_importance else []

    return {
        "dataset_id": str(dataset.id),
        "top_features": top_features,
        "total_features": len(feature_importance),
        "method": "SHAP",
    }
