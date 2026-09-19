from pathlib import Path
import json

import joblib
import pandas as pd


DATASET_ID = "f99a1cac-51a4-4d18-9b82-a06d975dd97b"

BALANCED_TEST_PATH = Path(
    "storage/balanced/ieee_cis_test.csv"
)

MODEL_DIR = Path("storage/models") / DATASET_ID

MODEL_PATH = MODEL_DIR / "phoenix_xgboost_model.joblib"
FEATURES_PATH = MODEL_DIR / "model_features.json"
MEDIANS_PATH = MODEL_DIR / "feature_medians.json"


print("\nLoading Phoenix model...")

model = joblib.load(MODEL_PATH)

with open(FEATURES_PATH, "r") as f:
    model_features = json.load(f)

with open(MEDIANS_PATH, "r") as f:
    medians = pd.Series(json.load(f))


print("Model loaded successfully.")
print("Expected model features:", len(model_features))


print("\nLoading IEEE-CIS test data...")

df = pd.read_csv(BALANCED_TEST_PATH)

print("Test rows:", len(df))
print("Test columns:", len(df.columns))


if "isFraud" not in df.columns:
    raise RuntimeError(
        "isFraud column was not found in the test dataset."
    )


fraud_rows = df[df["isFraud"] == 1]

if fraud_rows.empty:
    raise RuntimeError(
        "No fraud transactions were found in the test dataset."
    )


transaction = fraud_rows.iloc[[0]].copy()

actual_label = int(transaction["isFraud"].iloc[0])

transaction_id = "TEST_FRAUD_TRANSACTION"


print("\nSelected real fraud transaction")
print("--------------------------------")
print("TransactionID:", transaction_id)
print("Actual isFraud:", actual_label)


X = transaction.drop(
    columns=["isFraud"],
    errors="ignore",
)


X = X.reindex(
    columns=model_features,
    fill_value=0,
)


X = X.apply(
    pd.to_numeric,
    errors="coerce",
)


X = X.replace(
    [float("inf"), float("-inf")],
    pd.NA,
)


for column in X.columns:
    if X[column].isna().any():
        X[column] = X[column].fillna(
            medians.get(column, 0)
        )


X = X.fillna(0)


print("\nRunning Phoenix XGBoost prediction...")

fraud_probability = float(
    model.predict_proba(X)[0][1]
)

predicted_label = int(
    fraud_probability >= 0.5
)


if fraud_probability < 0.30:
    risk_level = "LOW"
    decision = "APPROVE"

elif fraud_probability < 0.70:
    risk_level = "MEDIUM"
    decision = "VERIFY"

else:
    risk_level = "HIGH"
    decision = "BLOCK"


print("\nPHOENIX PREDICTION")
print("------------------")
print("TransactionID:", transaction_id)
print(
    "Actual label:",
    "FRAUD" if actual_label == 1 else "LEGITIMATE",
)
print(
    "Predicted label:",
    "FRAUD" if predicted_label == 1 else "LEGITIMATE",
)
print(
    "Fraud probability:",
    round(fraud_probability, 4),
)
print("Risk level:", risk_level)
print("Decision:", decision)


print("\nMODEL INPUT")
print("-----------")
print("Features supplied to XGBoost:", X.shape[1])
print("Missing values after preparation:", X.isna().sum().sum())


print("\nTEST RESULT")
print("-----------")

if actual_label == predicted_label:
    print("PASS: Model prediction matches the actual label.")
else:
    print("INFO: Model prediction differs from the actual label.")


print("\nFull transaction scoring test completed.")