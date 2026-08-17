from pathlib import Path

import joblib
import pandas as pd
import matplotlib.pyplot as plt

from fastapi import HTTPException
from sqlalchemy.orm import Session

from xgboost import XGBClassifier

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    ConfusionMatrixDisplay,
    roc_curve,
)

from app.models.dataset import Dataset
from app.models.model_report import ModelReport


# --------------------------------------------------
# Storage paths
# --------------------------------------------------

TRAINING_PATH = Path("storage/training")
MODEL_PATH = Path("storage/models")
GRAPH_PATH = Path("storage/graphs")


# --------------------------------------------------
# Train XGBoost Model
# --------------------------------------------------

def train_xgboost_model(dataset_id, db: Session):

    # --------------------------------------------------
    # Find dataset
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
    # Create dataset-specific graph folder
    # --------------------------------------------------

    dataset_graph_path = (
        GRAPH_PATH / str(dataset.id)
    )

    dataset_graph_path.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------
    # Dataset-specific training folder
    # --------------------------------------------------

    dataset_training_path = (
        TRAINING_PATH / str(dataset.id)
    )

    if not dataset_training_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Training data not found for this dataset."
        )

    # --------------------------------------------------
    # Training files
    # --------------------------------------------------

    X_train_path = (
        dataset_training_path / "X_train.csv"
    )

    y_train_path = (
        dataset_training_path / "y_train.csv"
    )

    X_test_path = (
        dataset_training_path / "X_test.csv"
    )

    y_test_path = (
        dataset_training_path / "y_test.csv"
    )

    required_files = [
        X_train_path,
        y_train_path,
        X_test_path,
        y_test_path,
    ]

    for file_path in required_files:

        if not file_path.exists():
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Training file not found: "
                    f"{file_path.name}"
                )
            )

    # --------------------------------------------------
    # Load training and testing data
    # --------------------------------------------------

    try:
        X_train = pd.read_csv(X_train_path)
        y_train = pd.read_csv(y_train_path).squeeze()
        X_test = pd.read_csv(X_test_path)
        y_test = pd.read_csv(y_test_path).squeeze()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to load training data: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Validate row counts
    # --------------------------------------------------

    if len(X_train) != len(y_train):
        raise HTTPException(
            status_code=400,
            detail=(
                f"X_train rows = {len(X_train)}, "
                f"y_train rows = {len(y_train)}"
            )
        )

    if len(X_test) != len(y_test):
        raise HTTPException(
            status_code=400,
            detail=(
                f"X_test rows = {len(X_test)}, "
                f"y_test rows = {len(y_test)}"
            )
        )

    # --------------------------------------------------
    # Create model storage folder
    # --------------------------------------------------

    dataset_model_path = (
        MODEL_PATH / str(dataset.id)
    )

    dataset_model_path.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------
    # Define + train XGBoost model
    # --------------------------------------------------

    model = XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        eval_metric="logloss"
    )

    try:
        model.fit(X_train, y_train)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Model training failed: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Predictions
    # --------------------------------------------------

    try:
        y_pred = model.predict(X_test)
        y_probability = model.predict_proba(X_test)[:, 1]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Model prediction failed: {str(e)}"
            )
        )

    # --------------------------------------------------
    # Calculate metrics
    # --------------------------------------------------

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)

    try:
        roc_auc = roc_auc_score(y_test, y_probability)

    except ValueError:
        roc_auc = 0.0

    # --------------------------------------------------
    # Confusion Matrix — PNG (kept) + structured data (new)
    # --------------------------------------------------

    confusion_matrix_path = (
        dataset_graph_path / "confusion_matrix.png"
    )

    cm = confusion_matrix(y_test, y_pred)

    cm_display = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=["Legitimate", "Fraud"]
    )

    cm_display.plot()
    plt.title("XGBoost Confusion Matrix")
    plt.tight_layout()
    plt.savefig(confusion_matrix_path, dpi=150)
    plt.close()

    # cm is ordered by sorted label value (0, 1):
    # cm[0][0]=TN  cm[0][1]=FP
    # cm[1][0]=FN  cm[1][1]=TP
    confusion_matrix_data = {
        "matrix": cm.tolist(),
        "labels": ["Legitimate", "Fraud"],
        "true_negative": int(cm[0][0]),
        "false_positive": int(cm[0][1]),
        "false_negative": int(cm[1][0]),
        "true_positive": int(cm[1][1]),
    }

    # --------------------------------------------------
    # ROC Curve — PNG (kept) + structured data (new)
    # --------------------------------------------------

    roc_curve_path = (
        dataset_graph_path / "roc_curve.png"
    )

    roc_curve_data = None

    try:
        fpr, tpr, thresholds = roc_curve(y_test, y_probability)

        plt.figure()
        plt.plot(fpr, tpr, label=f"XGBoost (AUC = {roc_auc:.4f})")
        plt.plot([0, 1], [0, 1], linestyle="--", label="Random Classifier")
        plt.xlabel("False Positive Rate")
        plt.ylabel("True Positive Rate")
        plt.title("XGBoost ROC Curve")
        plt.legend()
        plt.tight_layout()
        plt.savefig(roc_curve_path, dpi=150)
        plt.close()

        roc_curve_data = {
            "fpr": [round(float(x), 4) for x in fpr],
            "tpr": [round(float(x), 4) for x in tpr],
            "auc": round(float(roc_auc), 4),
        }

    except ValueError:
        roc_curve_path = None
        roc_curve_data = None

    # --------------------------------------------------
    # Feature Importance — PNG (kept) + structured data (new)
    # --------------------------------------------------

    feature_importance_path = (
        dataset_graph_path / "feature_importance.png"
    )

    feature_importance_df = pd.DataFrame({
        "feature": X_train.columns,
        "importance": model.feature_importances_
    })

    feature_importance_df = feature_importance_df.sort_values(
        by="importance",
        ascending=False
    )

    top_features = feature_importance_df.head(15)

    plt.figure(figsize=(10, 6))
    plt.barh(top_features["feature"][::-1], top_features["importance"][::-1])
    plt.xlabel("Importance")
    plt.ylabel("Feature")
    plt.title("XGBoost Feature Importance")
    plt.tight_layout()
    plt.savefig(feature_importance_path, dpi=150)
    plt.close()

    feature_importance_data = [
        {
            "feature": str(row["feature"]),
            "importance": round(float(row["importance"]), 4),
        }
        for _, row in top_features.iterrows()
    ]

    # --------------------------------------------------
    # Save trained model
    # --------------------------------------------------

    model_filename = "xgboost.joblib"

    model_file_path = (
        dataset_model_path / model_filename
    )

    joblib.dump(model, model_file_path)

    # --------------------------------------------------
    # Save Model Report
    # --------------------------------------------------

    report = ModelReport(
        dataset_id=dataset.id,
        model_name="XGBoost",
        accuracy=float(accuracy),
        precision=float(precision),
        recall=float(recall),
        f1_score=float(f1),
        roc_auc=float(roc_auc),
        train_rows=len(X_train),
        test_rows=len(X_test),
        model_path=str(model_file_path),
        status="Completed",
        confusion_matrix=confusion_matrix_data,
        roc_curve=roc_curve_data,
        feature_importance=feature_importance_data,
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    # --------------------------------------------------
    # Return result
    # --------------------------------------------------

    return {
        "dataset_id": str(dataset.id),
        "dataset_name": dataset.dataset_name,
        "model_name": "XGBoost",
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1_score": round(float(f1), 4),
        "roc_auc": round(float(roc_auc), 4),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "model_path": str(model_file_path),
        "confusion_matrix": confusion_matrix_data,
        "roc_curve": roc_curve_data,
        "feature_importance": feature_importance_data,
        "graphs": {
            "confusion_matrix": str(confusion_matrix_path),
            "roc_curve": str(roc_curve_path) if roc_curve_path else None,
            "feature_importance": str(feature_importance_path)
        },
        "status": "Completed"
    }
