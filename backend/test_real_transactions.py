from pathlib import Path
import json

import joblib
import pandas as pd


DATASET_ID = "f99a1cac-51a4-4d18-9b82-a06d975dd97b"

MODEL_DIR = Path("storage/models") / DATASET_ID

MODEL_PATH = MODEL_DIR / "phoenix_xgboost_model.joblib"
FEATURES_PATH = MODEL_DIR / "model_features.json"
MEDIANS_PATH = MODEL_DIR / "feature_medians.json"

TEST_DATA_PATH = Path(
    "storage/balanced/ieee_cis_test.csv"
)


print("Loading Phoenix model...")

model = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


print("\nLoading model feature list...")

with open(FEATURES_PATH, "r") as f:
    model_features = json.load(f)

print(
    "Expected model features:",
    len(model_features)
)


print("\nLoading feature medians...")

with open(MEDIANS_PATH, "r") as f:
    medians = pd.Series(json.load(f))

print("Feature medians loaded successfully.")


print("\nLoading IEEE-CIS test data...")

df = pd.read_csv(TEST_DATA_PATH)

print("Test rows:", len(df))
print("Test columns:", len(df.columns))


# --------------------------------------------------
# Select the two transactions supplied by the user
# --------------------------------------------------

fraud_transaction = df[
    df["isFraud"] == 1
].head(1)

legitimate_transaction = df[
    df["isFraud"] == 0
].head(1)


if fraud_transaction.empty:
    raise RuntimeError(
        "No fraud transaction found."
    )

if legitimate_transaction.empty:
    raise RuntimeError(
        "No legitimate transaction found."
    )


# --------------------------------------------------
# Prepare transaction for Phoenix model
# --------------------------------------------------

def prepare_transaction(transaction):

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

    return X


# --------------------------------------------------
# Run Phoenix prediction
# --------------------------------------------------

def test_transaction(transaction, name):

    X = prepare_transaction(transaction)

    actual_label = int(
        transaction["isFraud"].iloc[0]
    )

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


    print("\n================================")
    print(name)
    print("================================")

    print(
        "Actual label:",
        "FRAUD"
        if actual_label == 1
        else "LEGITIMATE",
    )

    print(
        "Predicted label:",
        "FRAUD"
        if predicted_label == 1
        else "LEGITIMATE",
    )

    print(
        "Fraud probability:",
        round(fraud_probability, 4),
    )

    print(
        "Fraud probability (%):",
        round(fraud_probability * 100, 2),
        "%",
    )

    print(
        "Risk level:",
        risk_level,
    )

    print(
        "Decision:",
        decision,
    )

    print(
        "Features supplied:",
        X.shape[1],
    )

    print(
        "Missing values after preparation:",
        X.isna().sum().sum(),
    )

    if actual_label == predicted_label:

        print(
            "Result: PASS - prediction matches actual label."
        )

    else:

        print(
            "Result: INFO - prediction differs from actual label."
        )


# --------------------------------------------------
# Test both transactions
# --------------------------------------------------

test_transaction(
    fraud_transaction,
    "REAL FRAUD TRANSACTION",
)

test_transaction(
    legitimate_transaction,
    "REAL LEGITIMATE TRANSACTION",
)


print("\nFull real-transaction testing completed.")