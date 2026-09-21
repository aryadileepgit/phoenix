"""
Model performance from stored results.

Serves the latest ModelReport row plus the training metadata
file. Precision-recall data was never stored by the training
pipeline, so pr_auc/pr_curve are explicit nulls rather than
fabricated curves.
"""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
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
            "pr_auc": None,
        },
        "roc_curve": report.roc_curve,
        "pr_curve": None,
        "confusion_matrix": report.confusion_matrix,
        "feature_importance": report.feature_importance,
    }
