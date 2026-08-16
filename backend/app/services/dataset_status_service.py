from pathlib import Path

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.dataset import Dataset
from app.models.model_report import ModelReport
from app.models.training_report import TrainingReport


# ==================================================
# Graphs Storage Path
# ==================================================

GRAPH_PATH = Path("storage/graphs")


# ==================================================
# Get Latest Dataset
# ==================================================

def get_latest_dataset(db: Session):

    # ----------------------------------------------
    # Find most recently uploaded dataset
    # ----------------------------------------------

    dataset = (
        db.query(Dataset)
        .order_by(Dataset.upload_date.desc())
        .first()
    )

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail="No datasets found."
        )

    # ----------------------------------------------
    # Get latest model report
    # ----------------------------------------------

    model_report = (
        db.query(ModelReport)
        .filter(
            ModelReport.dataset_id == dataset.id
        )
        .order_by(
            ModelReport.created_at.desc()
        )
        .first()
    )

    # ----------------------------------------------
    # Get latest training report
    # ----------------------------------------------

    training_report = (
        db.query(TrainingReport)
        .filter(
            TrainingReport.dataset_id == dataset.id
        )
        .order_by(
            TrainingReport.created_at.desc()
        )
        .first()
    )

    # ==================================================
    # MODEL INFORMATION
    # ==================================================

    model_data = None

    if model_report is not None:

        model_data = {

            "id": str(
                model_report.id
            ),

            "model_name":
                model_report.model_name,

            "accuracy":
                float(model_report.accuracy),

            "precision":
                float(model_report.precision),

            "recall":
                float(model_report.recall),

            "f1_score":
                float(model_report.f1_score),

            "roc_auc":
                float(model_report.roc_auc),

            "train_rows":
                model_report.train_rows,

            "test_rows":
                model_report.test_rows,

            "model_path":
                model_report.model_path,

            "is_best_model":
                model_report.is_best_model,

            "status":
                model_report.status,

            "created_at":
                model_report.created_at
        }

    # ==================================================
    # TRAINING INFORMATION
    # ==================================================

    training_data = None

    if training_report is not None:

        training_data = {

            "training_rows":
                training_report.training_rows,

            "testing_rows":
                training_report.testing_rows,

            "total_features":
                training_report.total_features,

            "output_folder":
                training_report.output_folder,

            "status":
                training_report.status,

            "created_at":
                training_report.created_at
        }

    # ==================================================
    # GRAPH URLs
    # ==================================================

    graphs = {

        "confusion_matrix": None,

        "roc_curve": None,

        "feature_importance": None
    }

    dataset_graph_path = (
        GRAPH_PATH /
        str(dataset.id)
    )

    # ----------------------------------------------
    # Confusion Matrix
    # ----------------------------------------------

    confusion_matrix_file = (
        dataset_graph_path /
        "confusion_matrix.png"
    )

    if confusion_matrix_file.exists():

        graphs["confusion_matrix"] = (
            f"/dataset/graphs/"
            f"{dataset.id}/"
            f"confusion_matrix.png"
        )

    # ----------------------------------------------
    # ROC Curve
    # ----------------------------------------------

    roc_curve_file = (
        dataset_graph_path /
        "roc_curve.png"
    )

    if roc_curve_file.exists():

        graphs["roc_curve"] = (
            f"/dataset/graphs/"
            f"{dataset.id}/"
            f"roc_curve.png"
        )

    # ----------------------------------------------
    # Feature Importance
    # ----------------------------------------------

    feature_importance_file = (
        dataset_graph_path /
        "feature_importance.png"
    )

    if feature_importance_file.exists():

        graphs["feature_importance"] = (
            f"/dataset/graphs/"
            f"{dataset.id}/"
            f"feature_importance.png"
        )

    # ==================================================
    # RETURN COMPLETE LATEST DATASET
    # ==================================================

    return {

        "dataset": {

            "id":
                str(dataset.id),

            "dataset_name":
                dataset.dataset_name,

            "original_filename":
                dataset.original_filename,

            "total_records":
                dataset.total_records,

            "total_columns":
                dataset.total_columns,

            "status":
                dataset.status,

            "remarks":
                dataset.remarks,

            "upload_date":
                dataset.upload_date
        },

        "model":
            model_data,

        "training":
            training_data,

        "graphs":
            graphs
    }


# ==================================================
# Get Dataset History
# ==================================================

def get_dataset_history(db: Session):

    # ----------------------------------------------
    # Get all datasets
    # ----------------------------------------------

    datasets = (
        db.query(Dataset)
        .order_by(
            Dataset.upload_date.desc()
        )
        .all()
    )

    history = []

    # ----------------------------------------------
    # Process every dataset
    # ----------------------------------------------

    for dataset in datasets:

        # ------------------------------------------
        # Find latest model report
        # ------------------------------------------

        model_report = (
            db.query(ModelReport)
            .filter(
                ModelReport.dataset_id ==
                dataset.id
            )
            .order_by(
                ModelReport.created_at.desc()
            )
            .first()
        )

        # ------------------------------------------
        # Create history entry
        # ------------------------------------------

        entry = {

            "dataset_id":
                str(dataset.id),

            "dataset_name":
                dataset.dataset_name,

            "original_filename":
                dataset.original_filename,

            "total_records":
                dataset.total_records,

            "total_columns":
                dataset.total_columns,

            "status":
                dataset.status,

            "remarks":
                dataset.remarks,

            "upload_date":
                dataset.upload_date,

            "model":
                None
        }

        # ------------------------------------------
        # Add model metrics
        # ------------------------------------------

        if model_report is not None:

            entry["model"] = {

                "model_name":
                    model_report.model_name,

                "accuracy":
                    float(
                        model_report.accuracy
                    ),

                "precision":
                    float(
                        model_report.precision
                    ),

                "recall":
                    float(
                        model_report.recall
                    ),

                "f1_score":
                    float(
                        model_report.f1_score
                    ),

                "roc_auc":
                    float(
                        model_report.roc_auc
                    ),

                "train_rows":
                    model_report.train_rows,

                "test_rows":
                    model_report.test_rows,

                "status":
                    model_report.status,

                "created_at":
                    model_report.created_at
            }

        history.append(entry)

    # ----------------------------------------------
    # Return history
    # ----------------------------------------------

    return {

        "total_datasets":
            len(history),

        "datasets":
            history
    }