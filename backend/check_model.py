from pathlib import Path
import joblib

MODEL_PATH = Path("storage/models")

dataset_id = ""

model_path = (
    MODEL_PATH
    / dataset_id
    / "xgboost.joblib"
)

model = joblib.load(model_path)

print("\n========================================")
print("MODEL FEATURE CHECK")
print("========================================")

print("Expected features:")
print(model.feature_names_in_)

print("\nNumber of features:")
print(len(model.feature_names_in_))

print("========================================")