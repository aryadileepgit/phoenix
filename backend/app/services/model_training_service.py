from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from xgboost import XGBClassifier

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
    roc_curve,
)

from app.database.database import SessionLocal
from app.models.dataset import Dataset
from app.models.model_report import ModelReport


# ============================================================
# PATHS
# ============================================================

BALANCED_PATH = Path("storage/balanced")
MODEL_PATH = Path("storage/models")
GRAPH_PATH = Path("storage/graphs")

MODEL_PATH.mkdir(
    parents=True,
    exist_ok=True
)

GRAPH_PATH.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# FIND SMOTE FILES
# ============================================================

def find_smote_files(dataset_id):

    dataset_id = str(dataset_id)

    train_file = (
        BALANCED_PATH /
        "ieee_cis_train_balanced.csv"
    )

    test_file = (
        BALANCED_PATH /
        "ieee_cis_test.csv"
    )

    if not train_file.exists():

        raise FileNotFoundError(
            "SMOTE balanced training file was not found.\n"
            f"Expected: {train_file}"
        )

    if not test_file.exists():

        raise FileNotFoundError(
            "SMOTE test file was not found.\n"
            f"Expected: {test_file}"
        )

    return train_file, test_file


# ============================================================
# LOAD TRAINING DATA
# ============================================================

def load_training_data(dataset_id):

    dataset_id = str(dataset_id)

    print()
    print("=" * 70)
    print("SEARCHING FOR SMOTE DATA")
    print("=" * 70)

    train_balanced_file, test_file = find_smote_files(
        dataset_id
    )

    print()
    print("Balanced training file:")
    print(train_balanced_file)

    print()
    print("Test file:")
    print(test_file)

    # --------------------------------------------------------
    # Load CSV files
    # --------------------------------------------------------

    print()
    print("Loading balanced training data...")

    train_df = pd.read_csv(
        train_balanced_file
    )

    print("Loading untouched test data...")

    test_df = pd.read_csv(
        test_file
    )

    print()
    print(
        "Balanced training shape:",
        train_df.shape
    )

    print(
        "Test shape:",
        test_df.shape
    )

    # --------------------------------------------------------
    # Target validation
    # --------------------------------------------------------

    if "isFraud" not in train_df.columns:

        raise ValueError(
            "isFraud column is missing "
            "from balanced training dataset."
        )

    if "isFraud" not in test_df.columns:

        raise ValueError(
            "isFraud column is missing "
            "from test dataset."
        )

    # --------------------------------------------------------
    # Separate target
    # --------------------------------------------------------

    y_train = train_df["isFraud"]

    X_train = train_df.drop(
        columns=["isFraud"]
    )

    y_test = test_df["isFraud"]

    X_test = test_df.drop(
        columns=["isFraud"]
    )

    # --------------------------------------------------------
    # Remove TransactionID
    # --------------------------------------------------------

    if "TransactionID" in X_train.columns:

        X_train = X_train.drop(
            columns=["TransactionID"]
        )

    if "TransactionID" in X_test.columns:

        X_test = X_test.drop(
            columns=["TransactionID"]
        )

    # --------------------------------------------------------
    # Ensure same feature columns
    # --------------------------------------------------------

    common_columns = [
        column
        for column in X_train.columns
        if column in X_test.columns
    ]

    if not common_columns:

        raise ValueError(
            "No common feature columns found "
            "between training and test datasets."
        )

    X_train = X_train[
        common_columns
    ]

    X_test = X_test[
        common_columns
    ]

    # --------------------------------------------------------
    # Convert features to numeric
    # --------------------------------------------------------

    print()
    print("Converting features to numeric...")

    X_train = X_train.apply(
        pd.to_numeric,
        errors="coerce"
    )

    X_test = X_test.apply(
        pd.to_numeric,
        errors="coerce"
    )

    # --------------------------------------------------------
    # Replace infinite values
    # --------------------------------------------------------

    X_train = X_train.replace(
        [np.inf, -np.inf],
        np.nan
    )

    X_test = X_test.replace(
        [np.inf, -np.inf],
        np.nan
    )

    # --------------------------------------------------------
    # Median imputation
    # --------------------------------------------------------

    print(
        "Handling missing values..."
    )

    train_medians = X_train.median()
    median_path = MODEL_PATH / str(dataset_id)
    median_path.mkdir(parents=True, exist_ok=True)

    with open(median_path / "feature_medians.json", "w") as f:
      json.dump(train_medians.to_dict(), f)

    X_train = X_train.fillna(
        train_medians
    )

    X_test = X_test.fillna(
        train_medians
    )

    # --------------------------------------------------------
    # Remaining missing values
    # --------------------------------------------------------

    X_train = X_train.fillna(0)

    X_test = X_test.fillna(0)

    # --------------------------------------------------------
    # Target conversion
    # --------------------------------------------------------

    y_train = pd.to_numeric(
        y_train,
        errors="coerce"
    ).fillna(0).astype(int)

    y_test = pd.to_numeric(
        y_test,
        errors="coerce"
    ).fillna(0).astype(int)

    # --------------------------------------------------------
    # Final validation
    # --------------------------------------------------------

    if len(X_train) != len(y_train):

        raise ValueError(
            "Training feature/target row count mismatch."
        )

    if len(X_test) != len(y_test):

        raise ValueError(
            "Test feature/target row count mismatch."
        )

    print()
    print("=" * 70)
    print("TRAINING DATA")
    print("=" * 70)

    print(
        "Rows:",
        len(X_train)
    )

    print(
        "Features:",
        len(X_train.columns)
    )

    print()
    print("Fraud distribution:")

    print(
        y_train.value_counts()
    )

    print()
    print("=" * 70)
    print("TEST DATA")
    print("=" * 70)

    print(
        "Rows:",
        len(X_test)
    )

    print(
        "Features:",
        len(X_test.columns)
    )

    print()
    print("Fraud distribution:")

    print(
        y_test.value_counts()
    )

    return (
        X_train,
        y_train,
        X_test,
        y_test
    )


# ============================================================
# TRAIN XGBOOST MODEL
# ============================================================

def train_xgboost_model(
    dataset_id,
    *args,
    **kwargs
):

    dataset_id = str(
        dataset_id
    )

    db = SessionLocal()

    try:

        # ====================================================
        # FIND DATASET
        # ====================================================

        dataset = (
            db.query(Dataset)
            .filter(
                Dataset.id == dataset_id
            )
            .first()
        )

        if dataset is None:

            raise ValueError(
                f"Dataset {dataset_id} "
                f"was not found."
            )

        # ====================================================
        # START
        # ====================================================

        print()
        print("=" * 70)
        print("PHOENIX FRAUD DETECTION")
        print("XGBOOST MODEL TRAINING")
        print("=" * 70)

        # ====================================================
        # LOAD DATA
        # ====================================================

        (
            X_train,
            y_train,
            X_test,
            y_test
        ) = load_training_data(
            dataset_id
        )

        # ====================================================
        # CREATE MODEL
        # ====================================================

        print()
        print("=" * 70)
        print("CREATING XGBOOST MODEL")
        print("=" * 70)

        model = XGBClassifier(

            n_estimators=300,

            max_depth=6,

            learning_rate=0.08,

            subsample=0.85,

            colsample_bytree=0.85,

            objective="binary:logistic",

            eval_metric="logloss",

            random_state=42,

            n_jobs=-1
        )

        # ====================================================
        # TRAIN
        # ====================================================

        print()
        print("Training started...")

        model.fit(
            X_train,
            y_train
        )

        print()
        print(
            "Training completed successfully."
        )

        # ====================================================
        # PREDICTION
        # ====================================================

        print()
        print("Generating predictions...")

        y_pred = model.predict(
            X_test
        )

        y_probability = (
            model.predict_proba(
                X_test
            )[:, 1]
        )

        # ====================================================
        # METRICS
        # ====================================================

        accuracy = accuracy_score(
            y_test,
            y_pred
        )

        precision = precision_score(
            y_test,
            y_pred,
            zero_division=0
        )

        recall = recall_score(
            y_test,
            y_pred,
            zero_division=0
        )

        f1 = f1_score(
            y_test,
            y_pred,
            zero_division=0
        )

        roc_auc = roc_auc_score(
            y_test,
            y_probability
        )

        cm = confusion_matrix(
            y_test,
            y_pred
        )

        # ====================================================
        # ROC DATA
        # ====================================================

        fpr, tpr, thresholds = roc_curve(
            y_test,
            y_probability
        )

        # ====================================================
        # FEATURE IMPORTANCE
        # ====================================================

        importance = (
            model.feature_importances_
        )

        feature_importance_df = (
            pd.DataFrame(
                {
                    "feature":
                        X_train.columns,

                    "importance":
                        importance
                }
            )
            .sort_values(
                by="importance",
                ascending=False
            )
        )

        top_features = (
            feature_importance_df
            .head(20)
        )

        # ====================================================
        # DISPLAY RESULTS
        # ====================================================

        print()
        print("=" * 70)
        print("PHOENIX MODEL PERFORMANCE")
        print("=" * 70)

        print(
            f"Accuracy  : {accuracy:.4f}"
        )

        print(
            f"Precision : {precision:.4f}"
        )

        print(
            f"Recall    : {recall:.4f}"
        )

        print(
            f"F1 Score  : {f1:.4f}"
        )

        print(
            f"ROC-AUC   : {roc_auc:.4f}"
        )

        print()
        print("Confusion Matrix:")

        print(cm)

        print()
        print("Classification Report:")

        print(
            classification_report(
                y_test,
                y_pred,
                zero_division=0
            )
        )

        # ====================================================
        # MODEL DIRECTORY
        # ====================================================

        dataset_model_path = (
            MODEL_PATH /
            dataset_id
        )

        dataset_model_path.mkdir(
            parents=True,
            exist_ok=True
        )

        # ====================================================
        # SAVE MODEL
        # ====================================================

        model_file = (
            dataset_model_path /
            "phoenix_xgboost_model.joblib"
        )

        joblib.dump(
            model,
            model_file
        )

        print()
        print("Model saved:")
        print(model_file)

        # ====================================================
        # SAVE FEATURE LIST
        # ====================================================

        feature_file = (
            dataset_model_path /
            "model_features.json"
        )

        with open(
            feature_file,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                list(X_train.columns),
                file,
                indent=4
            )

        # ====================================================
        # SAVE MODEL METADATA
        # ====================================================

        metadata = {

            "dataset_id":
                dataset_id,

            "model_name":
                "Phoenix XGBoost Fraud Detector",

            "algorithm":
                "XGBoost",

            "training_rows":
                int(len(X_train)),

            "testing_rows":
                int(len(X_test)),

            "features":
                int(len(X_train.columns)),

            "n_estimators":
                300,

            "max_depth":
                6,

            "learning_rate":
                0.08,

            "subsample":
                0.85,

            "colsample_bytree":
                0.85,

            "accuracy":
                float(accuracy),

            "precision":
                float(precision),

            "recall":
                float(recall),

            "f1_score":
                float(f1),

            "roc_auc":
                float(roc_auc)
        }

        metadata_file = (
            dataset_model_path /
            "model_metadata.json"
        )

        with open(
            metadata_file,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                metadata,
                file,
                indent=4
            )

        # ====================================================
        # GRAPH DIRECTORY
        # ====================================================

        dataset_graph_path = (
            GRAPH_PATH /
            dataset_id
        )

        dataset_graph_path.mkdir(
            parents=True,
            exist_ok=True
        )

        # ====================================================
        # CONFUSION MATRIX GRAPH
        # ====================================================

        plt.figure(
            figsize=(7, 6)
        )

        plt.imshow(
            cm,
            interpolation="nearest"
        )

        plt.title(
            "Phoenix Fraud Detection - Confusion Matrix"
        )

        plt.colorbar()

        plt.xticks(
            [0, 1],
            [
                "Legitimate",
                "Fraud"
            ]
        )

        plt.yticks(
            [0, 1],
            [
                "Legitimate",
                "Fraud"
            ]
        )

        plt.xlabel(
            "Predicted"
        )

        plt.ylabel(
            "Actual"
        )

        for i in range(2):

            for j in range(2):

                plt.text(
                    j,
                    i,
                    str(cm[i, j]),
                    ha="center",
                    va="center"
                )

        plt.tight_layout()

        confusion_file = (
            dataset_graph_path /
            "confusion_matrix.png"
        )

        plt.savefig(
            confusion_file,
            dpi=150
        )

        plt.close()

        # ====================================================
        # ROC CURVE GRAPH
        # ====================================================

        plt.figure(
            figsize=(8, 6)
        )

        plt.plot(
            fpr,
            tpr,
            label=(
                f"ROC-AUC = "
                f"{roc_auc:.4f}"
            )
        )

        plt.plot(
            [0, 1],
            [0, 1],
            linestyle="--"
        )

        plt.xlabel(
            "False Positive Rate"
        )

        plt.ylabel(
            "True Positive Rate"
        )

        plt.title(
            "Phoenix Fraud Detection - ROC Curve"
        )

        plt.legend()

        plt.tight_layout()

        roc_file = (
            dataset_graph_path /
            "roc_curve.png"
        )

        plt.savefig(
            roc_file,
            dpi=150
        )

        plt.close()

        # ====================================================
        # FEATURE IMPORTANCE GRAPH
        # ====================================================

        plt.figure(
            figsize=(10, 8)
        )

        plt.barh(
            top_features["feature"][::-1],
            top_features["importance"][::-1]
        )

        plt.xlabel(
            "Importance"
        )

        plt.ylabel(
            "Feature"
        )

        plt.title(
            "Top 20 Fraud Detection Features"
        )

        plt.tight_layout()

        importance_file = (
            dataset_graph_path /
            "feature_importance.png"
        )

        plt.savefig(
            importance_file,
            dpi=150
        )

        plt.close()

        # ====================================================
        # FEATURE IMPORTANCE CSV
        # ====================================================

        importance_csv = (
            dataset_graph_path /
            "feature_importance.csv"
        )

        feature_importance_df.to_csv(
            importance_csv,
            index=False
        )

        # ====================================================
        # JSON DATA FOR DATABASE
        # ====================================================

        confusion_matrix_data = {

            "labels": [
                "Legitimate",
                "Fraud"
            ],

            "matrix": [
                [
                    int(cm[0, 0]),
                    int(cm[0, 1])
                ],
                [
                    int(cm[1, 0]),
                    int(cm[1, 1])
                ]
            ]
        }

        roc_curve_data = {

            "fpr": [
                float(value)
                for value in fpr
            ],

            "tpr": [
                float(value)
                for value in tpr
            ],

            "thresholds": [
                float(value)
                if np.isfinite(value)
                else None
                for value in thresholds
            ]
        }

        feature_importance_data = [

            {
                "feature":
                    str(row["feature"]),

                "importance":
                    float(row["importance"])
            }

            for _, row
            in top_features.iterrows()
        ]

        # ====================================================
        # CHECK BEST MODEL
        # ====================================================

        previous_best = (
            db.query(ModelReport)
            .filter(
                ModelReport.is_best_model == True
            )
            .first()
        )

        is_best_model = (
            previous_best is None
            or roc_auc >
            float(previous_best.roc_auc)
        )

        if is_best_model:

            (
                db.query(ModelReport)
                .filter(
                    ModelReport.is_best_model == True
                )
                .update(
                    {
                        ModelReport.is_best_model:
                            False
                    },
                    synchronize_session=False
                )
            )

        # ====================================================
        # DATABASE MODEL REPORT
        # ====================================================

        print()
        print("Saving model report...")

        report = ModelReport(

            dataset_id=dataset.id,

            model_name=
                "Phoenix XGBoost Fraud Detector",

            accuracy=float(
                accuracy
            ),

            precision=float(
                precision
            ),

            recall=float(
                recall
            ),

            f1_score=float(
                f1
            ),

            roc_auc=float(
                roc_auc
            ),

            train_rows=int(
                len(X_train)
            ),

            test_rows=int(
                len(X_test)
            ),

            confusion_matrix=
                confusion_matrix_data,

            roc_curve=
                roc_curve_data,

            feature_importance=
                feature_importance_data,

            model_path=
                str(model_file),

            is_best_model=
                is_best_model,

            status=
                "Completed"
        )

        db.add(
            report
        )

        db.commit()

        db.refresh(
            report
        )

        print(
            "Model report saved successfully."
        )

        # ====================================================
        # FINAL RESULT
        # ====================================================

        result = {

            "message":
                "XGBoost model trained successfully.",

            "model": {

                "dataset_id":
                    dataset_id,

                "model_name":
                    "Phoenix XGBoost Fraud Detector",

                "algorithm":
                    "XGBoost",

                "training_rows":
                    len(X_train),

                "testing_rows":
                    len(X_test),

                "features":
                    len(X_train.columns),

                "accuracy":
                    round(
                        float(accuracy),
                        4
                    ),

                "precision":
                    round(
                        float(precision),
                        4
                    ),

                "recall":
                    round(
                        float(recall),
                        4
                    ),

                "f1_score":
                    round(
                        float(f1),
                        4
                    ),

                "roc_auc":
                    round(
                        float(roc_auc),
                        4
                    ),

                "model_file":
                    str(model_file),

                "feature_file":
                    str(feature_file),

                "metadata_file":
                    str(metadata_file),

                "confusion_matrix":
                    str(confusion_file),

                "roc_curve":
                    str(roc_file),

                "feature_importance":
                    str(importance_file),

                "is_best_model":
                    is_best_model,

                "status":
                    "Completed"
            }
        }

        return result

    except Exception:

        db.rollback()

        raise

    finally:

        db.close()


# ============================================================
# BACKWARD COMPATIBILITY
# ============================================================

train_xgboost = train_xgboost_model