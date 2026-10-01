"""
Model performance from stored results.

Serves the latest ModelReport row plus the training metadata
file. pr_auc/pr_curve come from model_metadata.json: the
retraining worker stores them at promotion time, and older
models carry a backfill computed on the untouched IEEE test
set with the deployed artifact (see pr_auc_note in metadata).
"""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.ml_model import MLModel
from app.models.model_report import ModelReport


router = APIRouter(
    prefix="/model",
    tags=["Model Performance"],
)

MODEL_METADATA_PATH = Path(
    "storage/models/f99a1cac-51a4-4d18-9b82-a06d975dd97b"
    "/model_metadata.json"
)


@router.get("/performance")
def get_performance(db: Session = Depends(get_db)):
    report = (
        db.query(ModelReport)
        .order_by(desc(ModelReport.created_at))
        .first()
    )

    if report is None:
        raise HTTPException(
            status_code=404,
            detail="No model report found.",
        )

    metadata = {}
    if MODEL_METADATA_PATH.exists():
        try:
            metadata = json.loads(
                MODEL_METADATA_PATH.read_text(encoding="utf-8")
            )
        except (OSError, ValueError):
            metadata = {}

    previous = (
        db.query(MLModel)
        .filter(MLModel.status == "Superseded")
        .order_by(desc(MLModel.created_at))
        .first()
    )

    return {
        "model_info": {
            "model_name": report.model_name,
            "algorithm": metadata.get("algorithm", "XGBoost"),
            "features": int(
                metadata.get("features", 0) or 0
            ),
            "training_rows": report.train_rows,
            "test_rows": report.test_rows,
            "status": report.status,
            "is_best_model": bool(report.is_best_model),
            "model_path": report.model_path,
            "trained_at": report.created_at,
        },
        "metrics": {
            "accuracy": float(report.accuracy),
            "precision": float(report.precision),
            "recall": float(report.recall),
            "f1_score": float(report.f1_score),
            "roc_auc": float(report.roc_auc),
            "pr_auc": metadata.get("pr_auc"),
        },
        "previous_version": (
            {
                "version": previous.version,
                "status": previous.status,
                "roc_auc": float(previous.roc_auc or 0.0),
            }
            if previous
            else None
        ),
        "roc_curve": report.roc_curve,
        "pr_curve": metadata.get("pr_curve"),
        "confusion_matrix": report.confusion_matrix,
        "feature_importance": report.feature_importance,
    }
