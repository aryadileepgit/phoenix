"""
Phoenix runtime settings.

GET returns live configuration: decision thresholds and schema
confidence from storage/settings.json (or code defaults), drift
thresholds, whether a Gemini key is configured (never the key
itself), and system health probes (database, model artifact).

PUT persists validated overrides that actually take effect:
the scorer, schema evolution, and drift detection all read
through runtime_settings.
"""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.services.runtime_settings import (
    current_settings,
    save_overrides,
)


router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)

MODEL_METADATA_PATH = Path(
    "storage/models/f99a1cac-51a4-4d18-9b82-a06d975dd97b"
    "/model_metadata.json"
)


class ModelSettingsUpdate(BaseModel):
    fraud_threshold: float
    verification_threshold: float


class SchemaSettingsUpdate(BaseModel):
    min_confidence: float


class DriftSettingsUpdate(BaseModel):
    drift_ks_threshold: float
    drift_fraud_rate_threshold: float


def _system_status(db: Session):
    try:
        db.execute(text("SELECT 1"))
        database = "connected"
    except Exception:
        database = "disconnected"

    model_artifact = (
        "present"
        if MODEL_METADATA_PATH.exists()
        else "missing"
    )

    return {
        "api_status": "online",
        "database_status": database,
        "model_artifact": model_artifact,
    }


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    import json

    settings = current_settings()

    model_name = "Phoenix XGBoost Fraud Detector"
    if MODEL_METADATA_PATH.exists():
        try:
            metadata = json.loads(
                MODEL_METADATA_PATH.read_text(encoding="utf-8")
            )
            model_name = metadata.get("model_name", model_name)
        except (OSError, ValueError):
            pass

    return {
        "model": {
            "modelVersion": model_name,
            "fraudThreshold": settings["fraud_threshold"],
            "verificationThreshold": settings["verify_threshold"],
        },
        "schemaEvolution": {
            "geminiConfigured": bool(os.getenv("GEMINI_API_KEY")),
            "minConfidence": settings["min_confidence"],
        },
        "driftDetection": {
            "driftKsThreshold": settings["drift_ks_threshold"],
            "driftFraudRateThreshold": settings[
                "drift_fraud_rate_threshold"
            ],
        },
        "system": _system_status(db),
    }


@router.put("/model")
def update_model_settings(payload: ModelSettingsUpdate):
    try:
        saved = save_overrides(
            {
                "fraud_threshold": payload.fraud_threshold,
                "verify_threshold": payload.verification_threshold,
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "message": "Model thresholds updated.",
        "model": {
            "fraudThreshold": saved["fraud_threshold"],
            "verificationThreshold": saved["verify_threshold"],
        },
    }


@router.put("/schema-evolution")
def update_schema_settings(payload: SchemaSettingsUpdate):
    try:
        saved = save_overrides(
            {"min_confidence": payload.min_confidence}
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "message": "Schema evolution settings updated.",
        "schemaEvolution": {
            "minConfidence": saved["min_confidence"]
        },
    }


@router.put("/drift-detection")
def update_drift_settings(payload: DriftSettingsUpdate):
    try:
        saved = save_overrides(
            {
                "drift_ks_threshold": payload.drift_ks_threshold,
                "drift_fraud_rate_threshold": (
                    payload.drift_fraud_rate_threshold
                ),
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "message": "Drift detection settings updated.",
        "driftDetection": {
            "driftKsThreshold": saved["drift_ks_threshold"],
            "driftFraudRateThreshold": saved[
                "drift_fraud_rate_threshold"
            ],
        },
    }
