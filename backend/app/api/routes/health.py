"""
Public liveness/readiness probes. No auth required so load
balancers, Docker healthchecks, and supervisors can use them.

  GET /health -> process is alive
  GET /ready  -> process + Postgres + model artifacts ready
"""

import time
from pathlib import Path

from fastapi import APIRouter
from sqlalchemy import text

from app.database.database import SessionLocal

router = APIRouter(tags=["Health"])

MODEL_PATH = Path(
    "storage/models/f99a1cac-51a4-4d18-9b82-a06d975dd97b"
    "/phoenix_xgboost_model.joblib"
)

_STARTED_AT = time.time()


@router.get("/health")
def liveness():
    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - _STARTED_AT, 1),
    }


@router.get("/ready")
def readiness():
    checks = {}

    try:
        db = SessionLocal()

        try:
            db.execute(text("SELECT 1"))
            checks["database"] = True
        finally:
            db.close()
    except Exception as error:
        checks["database"] = False
        checks["database_error"] = str(error)[:200]

    checks["model_artifact"] = MODEL_PATH.exists()

    ready = bool(
        checks.get("database") and checks.get("model_artifact")
    )

    return {
        "ready": ready,
        "checks": checks,
    }
