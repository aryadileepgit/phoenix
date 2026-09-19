from pathlib import Path
import json

import joblib
import pandas as pd
import shap


DATASET_ID = "f99a1cac-51a4-4d18-9b82-a06d975dd97b"

MODEL_DIR = Path("storage/models") / DATASET_ID

MODEL_PATH = MODEL_DIR / "phoenix_xgboost_model.joblib"
FEATURES_PATH = MODEL_DIR / "model_features.json"
MEDIANS_PATH = MODEL_DIR / "feature_medians.json"

PREPROCESSOR_PATH = Path(
    "storage/preprocessing_models/ieee_cis_preprocessor.joblib"
)


class SHAPExplanationService:

    def __init__(self):
        self.model = joblib.load(MODEL_PATH)
        self.preprocessor = joblib.load(PREPROCESSOR_PATH)

        with open(FEATURES_PATH, "r") as f:
            self.model_features = json.load(f)

        with open(MEDIANS_PATH, "r") as f:
            self.medians = json.load(f)

        self.explainer = shap.TreeExplainer(self.model)

    def explain(self, processed_data: pd.DataFrame):

        shap_values = self.explainer.shap_values(
            processed_data
        )

        if isinstance(shap_values, list):
            shap_values = shap_values[1]

        values = shap_values[0]

        feature_values = processed_data.iloc[0]

        explanations = []

        for feature, shap_value in zip(
            self.model_features,
            values,
        ):
            explanations.append(
                {
                    "feature": feature,
                    "value": self._clean_value(
                        feature_values[feature]
                    ),
                    "shap_value": round(
                        float(shap_value),
                        6,
                    ),
                    "impact": (
                        "INCREASES_FRAUD_RISK"
                        if shap_value > 0
                        else "DECREASES_FRAUD_RISK"
                    ),
                }
            )

        explanations.sort(
            key=lambda x: abs(x["shap_value"]),
            reverse=True,
        )

        return explanations[:10]

    def _clean_value(self, value):

        if pd.isna(value):
            return None

        if hasattr(value, "item"):
            return value.item()

        return value


shap_explanation_service = SHAPExplanationService()