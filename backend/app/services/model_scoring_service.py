from pathlib import Path
import json
import math

import joblib
import pandas as pd


DATASET_ID = "f99a1cac-51a4-4d18-9b82-a06d975dd97b"

MODEL_DIR = Path("storage/models") / DATASET_ID

MODEL_PATH = MODEL_DIR / "phoenix_xgboost_model.joblib"
FEATURES_PATH = MODEL_DIR / "model_features.json"
MEDIANS_PATH = MODEL_DIR / "feature_medians.json"

PREPROCESSOR_PATH = Path(
    "storage/preprocessing_models/ieee_cis_preprocessor.joblib"
)


class FraudScoringService:

    def __init__(self):
        self.model = joblib.load(MODEL_PATH)
        self.preprocessor = joblib.load(PREPROCESSOR_PATH)

        with open(FEATURES_PATH, "r") as f:
            self.model_features = json.load(f)

        with open(MEDIANS_PATH, "r") as f:
            self.medians = json.load(f)

    def score(self, transaction_data: dict):

        df = self._build_features(transaction_data)

        processed = self._preprocess(df)

        probability = float(
            self.model.predict_proba(processed)[0][1]
        )

        predicted_label = probability >= 0.5

        risk_level, decision = self._risk_decision(probability)

        return {
            "fraud_probability": round(probability, 4),
            "predicted_label": predicted_label,
            "risk_level": risk_level,
            "decision": decision,
        }

    def _build_features(self, transaction_data: dict):

        df = pd.DataFrame([transaction_data])

        # ---------------------------------------------------------
        # Merge additional IEEE-CIS transaction data
        # ---------------------------------------------------------

        additional_data = transaction_data.get("additional_data")

        if isinstance(additional_data, dict):

            for key, value in additional_data.items():
                df[key] = value

        # ---------------------------------------------------------
        # Map normal API fields to IEEE-CIS fields
        # ---------------------------------------------------------

        df["TransactionAmt"] = transaction_data.get("amount")

        product_code = transaction_data.get("product_code")

        if product_code is not None:
            df["ProductCD"] = product_code

        # ---------------------------------------------------------
        # Merge card information
        # ---------------------------------------------------------

        card_information = transaction_data.get(
            "card_information"
        )

        if isinstance(card_information, dict):

            for key, value in card_information.items():
                df[key] = value

        # ---------------------------------------------------------
        # Merge device information
        # ---------------------------------------------------------

        device_information = transaction_data.get(
            "device_information"
        )

        if isinstance(device_information, dict):

            for key, value in device_information.items():
                df[key] = value

        # ---------------------------------------------------------
        # Transaction amount logarithm
        # ---------------------------------------------------------

        amount = pd.to_numeric(
            df["TransactionAmt"],
            errors="coerce"
        )

        df["transaction_amount_log"] = amount.apply(
            lambda x: math.log1p(x)
            if pd.notna(x) and x >= 0
            else 0
        )

        # ---------------------------------------------------------
        # Transaction time features
        # ---------------------------------------------------------

        transaction_time = pd.to_datetime(
            df["transaction_time"],
            errors="coerce"
        )

        df["transaction_hour"] = (
            transaction_time.dt.hour.fillna(0)
        )

        df["transaction_day"] = (
            transaction_time.dt.day.fillna(0)
        )

        df["is_night_transaction"] = (
            (transaction_time.dt.hour < 6)
            | (transaction_time.dt.hour >= 22)
        ).fillna(False).astype(int)

        # ---------------------------------------------------------
        # Card information count
        # ---------------------------------------------------------

        card_fields = [
            "card1",
            "card2",
            "card3",
            "card4",
            "card5",
            "card6",
        ]

        df["card_information_count"] = 0

        for field in card_fields:

            if field in df.columns:

                df["card_information_count"] += (
                    df[field].notna().astype(int)
                )

        # ---------------------------------------------------------
        # Email information
        # ---------------------------------------------------------

        email_fields = [
            "P_emaildomain",
            "R_emaildomain",
        ]

        existing_email_fields = [
            field
            for field in email_fields
            if field in df.columns
        ]

        if existing_email_fields:

            df["email_information_available"] = (
                df[existing_email_fields]
                .notna()
                .any(axis=1)
                .astype(int)
            )

        else:

            df["email_information_available"] = 0

        # ---------------------------------------------------------
        # Email domain match
        # ---------------------------------------------------------
        #
        # R_emaildomain was removed during training because
        # of high missingness. Therefore this feature defaults
        # to 0 unless explicit matching information is supplied.
        #

        df["email_domain_match"] = 0

        # ---------------------------------------------------------
        # Address information
        # ---------------------------------------------------------

        address_fields = [
            "addr1",
            "addr2",
        ]

        existing_address_fields = [
            field
            for field in address_fields
            if field in df.columns
        ]

        if existing_address_fields:

            df["address_information_available"] = (
                df[existing_address_fields]
                .notna()
                .any(axis=1)
                .astype(int)
            )

        else:

            df["address_information_available"] = 0

        # ---------------------------------------------------------
        # Distance information
        # ---------------------------------------------------------

        distance_fields = [
            "dist1",
            "dist2",
        ]

        existing_distance_fields = [
            field
            for field in distance_fields
            if field in df.columns
        ]

        if existing_distance_fields:

            df["distance_information_available"] = (
                df[existing_distance_fields]
                .notna()
                .any(axis=1)
                .astype(int)
            )

        else:

            df["distance_information_available"] = 0

        # ---------------------------------------------------------
        # Identity information
        # ---------------------------------------------------------

        identity_fields = [
            field
            for field in df.columns
            if field.startswith("id_")
        ]

        if identity_fields:

            df["identity_information_count"] = (
                df[identity_fields]
                .notna()
                .sum(axis=1)
            )

            df["identity_information_available"] = (
                df["identity_information_count"] > 0
            ).astype(int)

        else:

            df["identity_information_count"] = 0
            df["identity_information_available"] = 0

        # ---------------------------------------------------------
        # Device information availability
        # ---------------------------------------------------------

        device_fields = [
            "DeviceType",
            "DeviceInfo",
        ]

        existing_device_fields = [
            field
            for field in device_fields
            if field in df.columns
        ]

        if existing_device_fields:

            df["device_information_available"] = (
                df[existing_device_fields]
                .notna()
                .any(axis=1)
                .astype(int)
            )

        else:

            df["device_information_available"] = 0

        # ---------------------------------------------------------
        # Missing model feature count
        # ---------------------------------------------------------

        missing_features = [
            feature
            for feature in self.model_features
            if feature not in df.columns
        ]

        df["missing_feature_count"] = len(
            missing_features
        )

        return df

    def _preprocess(self, df):

        # ---------------------------------------------------------
        # Get the exact raw columns expected by the saved
        # IEEE-CIS ColumnTransformer
        # ---------------------------------------------------------

        preprocessor_columns = []

        for transformer_name, transformer, columns in (
            self.preprocessor.transformers_
        ):

            if transformer_name == "remainder":
                continue

            preprocessor_columns.extend(columns)

        preprocessor_input = df.reindex(
            columns=preprocessor_columns
        )

        # ---------------------------------------------------------
        # Apply the exact saved preprocessing pipeline
        # ---------------------------------------------------------

        processed_array = self.preprocessor.transform(
            preprocessor_input
        )

        processed_columns = (
            self.preprocessor
            .get_feature_names_out()
            .tolist()
        )

        processed_df = pd.DataFrame(
            processed_array,
            columns=processed_columns
        )

        # ---------------------------------------------------------
        # Add engineered features
        # ---------------------------------------------------------

        engineered_features = [
            "transaction_amount_log",
            "transaction_hour",
            "transaction_day",
            "is_night_transaction",
            "email_domain_match",
            "email_information_available",
            "address_information_available",
            "card_information_count",
            "distance_information_available",
            "identity_information_available",
            "identity_information_count",
            "device_information_available",
            "missing_feature_count",
        ]

        for feature in engineered_features:

            if feature in df.columns:

                processed_df[feature] = pd.to_numeric(
                    df[feature],
                    errors="coerce"
                ).values

        # ---------------------------------------------------------
        # Make sure every model feature exists
        # ---------------------------------------------------------

        for feature in self.model_features:

            if feature not in processed_df.columns:

                processed_df[feature] = None

        # ---------------------------------------------------------
        # Keep the exact model feature order
        # ---------------------------------------------------------

        processed_df = processed_df[
            self.model_features
        ]

        # ---------------------------------------------------------
        # Numeric conversion
        # ---------------------------------------------------------

        processed_df = processed_df.apply(
            pd.to_numeric,
            errors="coerce"
        )

        # ---------------------------------------------------------
        # Replace infinite values
        # ---------------------------------------------------------

        processed_df = processed_df.replace(
            [float("inf"), float("-inf")],
            pd.NA
        )

        # ---------------------------------------------------------
        # Apply training medians
        # ---------------------------------------------------------

        for feature in self.model_features:

            median = self.medians.get(feature)

            if median is not None:

                processed_df[feature] = (
                    processed_df[feature]
                    .fillna(median)
                )

        # ---------------------------------------------------------
        # Final fallback
        # ---------------------------------------------------------

        processed_df = processed_df.fillna(0)

        return processed_df

    def _risk_decision(self, probability):

        from app.services.runtime_settings import (
            get_thresholds,
        )

        verify_threshold, fraud_threshold = get_thresholds()

        if probability < verify_threshold:

            return "LOW", "APPROVE"

        elif probability < fraud_threshold:

            return "MEDIUM", "VERIFY"

        else:

            return "HIGH", "BLOCK"


fraud_scoring_service = FraudScoringService()