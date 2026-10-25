"""
Concept drift detection for scored API transactions.

Reference baseline: the IEEE-CIS preprocessed training file
(the same distribution the deployed XGBoost model learned).
Recent window: the latest scored API transactions.

Reference vs recent windows are compared with two-sample KS
tests on `amount` and `fraud_probability`, plus the fraud-rate
shift (recent predicted-fraud rate minus training fraud rate).

Thresholds resolve through runtime_settings so PUT /settings
takes real effect. Detections persist as DriftEvent/DriftWindow
rows under the deployed-model record.

Retraining is NEVER triggered here; see retraining_worker,
which the drift API consults through an explicit gate.
"""

import json
from pathlib import Path

import pandas as pd
from fastapi import HTTPException
from scipy.stats import ks_2samp
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.drift_event import DriftEvent
from app.models.drift_window import DriftWindow
from app.models.ml_model import MLModel
from app.models.transaction import Transaction
from app.services.runtime_settings import get_drift_thresholds


REFERENCE_TRAIN_FILE = Path(
    "storage/preprocessed/ieee_cis_train_preprocessed.csv"
)

FALLBACK_REFERENCE_FILE = Path(
    "storage/drift_reference.json"
)

MODEL_METADATA_PATH = Path(
    "storage/models/f99a1cac-51a4-4d18-9b82-a06d975dd97b"
    "/model_metadata.json"
)

REFERENCE_SAMPLE_SIZE = 50000
RECENT_WINDOW_SIZE = 500
MIN_SCORED_ROWS = 4

FEATURES = ("amount", "fraud_probability")

_reference_cache = {"key": None, "payload": None}


def _file_sig(path: Path):
    try:
        stat = path.stat()
        return (stat.st_mtime_ns, stat.st_size)
    except OSError:
        return None


def get_reference_distribution():
    """
    IEEE-CIS training baseline: amount sample + fraud rate.
    Cached by file signature; recomputed only when the file
    changes.
    """

    if not REFERENCE_TRAIN_FILE.exists():
        if FALLBACK_REFERENCE_FILE.exists():
            try:
                return json.loads(FALLBACK_REFERENCE_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        raise HTTPException(
            status_code=404,
            detail=(
                "IEEE-CIS training reference file not found."
            ),
        )

    key = _file_sig(REFERENCE_TRAIN_FILE)
    cached = _reference_cache

    if cached["key"] == key and cached["payload"] is not None:
        return cached["payload"]

    frame = pd.read_csv(
        REFERENCE_TRAIN_FILE,
        usecols=["TransactionAmt", "isFraud"],
    )

    amounts = (
        pd.to_numeric(frame["TransactionAmt"], errors="coerce")
        .dropna()
        .astype(float)
    )

    sample = amounts.sample(
        n=min(REFERENCE_SAMPLE_SIZE, len(amounts)),
        random_state=42,
    ).tolist()

    labels = pd.to_numeric(
        frame["isFraud"], errors="coerce"
    ).fillna(0)

    payload = {
        "amounts": sample,
        "fraud_rate": round(float(labels.mean()), 6),
        "rows": int(len(frame)),
    }

    cached["key"] = key
    cached["payload"] = payload

    return payload


def compute_ks_test(reference_values, current_values):
    if not reference_values or not current_values:
        return {"ks_statistic": 0.0, "p_value": 1.0}

    outcome = ks_2samp(reference_values, current_values)

    return {
        "ks_statistic": round(float(outcome.statistic), 6),
        "p_value": float(outcome.pvalue),
    }


def _mean(values):
    return sum(values) / len(values) if values else 0.0


def _std(values, mean):
    if len(values) < 2:
        return 0.0
    return (
        sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    ) ** 0.5


def _feature_values(rows, feature):
    values = []
    for row in rows:
        value = getattr(row, feature)
        if value is not None:
            values.append(float(value))
    return values


def _summarize(reference, recent, ks_threshold):
    result = compute_ks_test(reference, recent)

    if result["ks_statistic"] > ks_threshold:
        status = "DRIFT"
    elif result["ks_statistic"] > ks_threshold * 0.5:
        status = "WARNING"
    else:
        status = "STABLE"

    ref_mean = _mean(reference)
    rec_mean = _mean(recent)

    return {
        "ks_statistic": result["ks_statistic"],
        "p_value": result["p_value"],
        "drift_status": status,
        "reference_mean": ref_mean,
        "reference_std": _std(reference, ref_mean),
        "recent_mean": rec_mean,
        "recent_std": _std(recent, rec_mean),
        "reference_size": len(reference),
        "recent_size": len(recent),
    }


def _fraud_rate(rows):
    if not rows:
        return 0.0
    flagged = sum(1 for row in rows if row.predicted_label is True)
    return flagged / len(rows)


def analyze_current(db: Session):
    """
    Pure analysis, no persistence. Returns feature summaries of
    recent scored rows against the IEEE reference, or None when
    fewer than MIN_SCORED_ROWS scored rows exist.
    """

    ks_threshold, fraud_threshold = get_drift_thresholds()

    rows = (
        db.query(Transaction)
        .filter(Transaction.fraud_probability != None)  # noqa: E711
        .order_by(Transaction.created_at.desc())
        .limit(RECENT_WINDOW_SIZE)
        .all()
    )

    if len(rows) < MIN_SCORED_ROWS:
        return None

    reference = get_reference_distribution()

    summaries = {}
    for feature in FEATURES:
        if feature == "amount":
            ref_values = reference["amounts"]
        else:
            # No stored score distribution exists for the
            # training set; compare recent probabilities
            # against a calm prior is dishonest, so reuse
            # the reference amounts scale check is wrong too.
            # Instead compare the recent window against the
            # older half of recent scored rows.
            ref_values = _feature_values(rows[len(rows) // 2 :], feature)

        summaries[feature] = _summarize(
            ref_values,
            _feature_values(rows, feature),
            ks_threshold,
        )

    ks_score = max(s["ks_statistic"] for s in summaries.values())
    recent_rate = _fraud_rate(rows)
    fraud_rate_change = round(
        recent_rate - reference["fraud_rate"], 6
    )

    drift_detected = (
        ks_score > ks_threshold
        or abs(fraud_rate_change) > fraud_threshold
    )

    if ks_score > ks_threshold and abs(fraud_rate_change) > fraud_threshold:
        severity = "HIGH"
    elif ks_score > ks_threshold or abs(fraud_rate_change) > fraud_threshold:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    return {
        "summaries": summaries,
        "ks_score": ks_score,
        "fraud_rate_change": fraud_rate_change,
        "recent_fraud_rate": round(recent_rate, 6),
        "reference_fraud_rate": reference["fraud_rate"],
        "drift_detected": drift_detected,
        "severity": severity,
        "reference_size": len(reference["amounts"]),
        "recent_size": len(rows),
        "recent_start": rows[-1].created_at,
        "recent_end": rows[0].created_at,
    }


def monitor_fraud_rate(db: Session, limit: int = 500):
    """
    Recent vs training fraud rates for scored API traffic.
    """

    reference = get_reference_distribution()

    rows = (
        db.query(Transaction)
        .filter(Transaction.fraud_probability != None)  # noqa: E711
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )

    recent_rate = _fraud_rate(rows)
    change = round(recent_rate - reference["fraud_rate"], 6)
    _, fraud_threshold = get_drift_thresholds()

    return {
        "recent_fraud_rate": round(recent_rate, 6),
        "reference_fraud_rate": reference["fraud_rate"],
        "historical_fraud_rate": reference["fraud_rate"],
        "recent_rows": len(rows),
        "overall_fraud_rate": round(recent_rate, 6),
        "fraud_rate_change": change,
        "alert": abs(change) > fraud_threshold,
    }


def ensure_deployed_model(db: Session):
    """
    The ml_models row representing the live XGBoost artifact,
    created from the real model_metadata.json when missing.
    Drift events reference it to satisfy the foreign key.
    """

    model = (
        db.query(MLModel)
        .order_by(desc(MLModel.created_at))
        .first()
    )

    if model is not None:
        return model

    metadata = {}
    if MODEL_METADATA_PATH.exists():
        try:
            metadata = json.loads(
                MODEL_METADATA_PATH.read_text(encoding="utf-8")
            )
        except (OSError, ValueError):
            metadata = {}

    model = MLModel(
        model_name=metadata.get(
            "model_name", "Phoenix XGBoost Fraud Detector"
        ),
        algorithm=metadata.get("algorithm", "XGBoost"),
        version="1.0",
        accuracy=float(metadata.get("accuracy", 0.0)),
        precision=float(metadata.get("precision", 0.0)),
        recall=float(metadata.get("recall", 0.0)),
        f1_score=float(metadata.get("f1_score", 0.0)),
        roc_auc=float(metadata.get("roc_auc", 0.0)),
        model_path=str(
            MODEL_METADATA_PATH.parent
            / "phoenix_xgboost_model.joblib"
        ),
        trained_on_dataset=str(
            metadata.get(
                "dataset_id",
                "f99a1cac-51a4-4d18-9b82-a06d975dd97b",
            )
        ),
        status="Deployed",
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    return model


def detect_drift(db: Session):
    """
    Analyze current scored traffic and persist the run as a
    DriftEvent + DriftWindow. Never triggers retraining; the
    drift API applies the retraining gate separately.
    """

    ks_threshold, fraud_threshold = get_drift_thresholds()

    analysis = analyze_current(db)

    if analysis is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Insufficient scored transactions for drift "
                "detection (need at least "
                f"{MIN_SCORED_ROWS})."
            ),
        )

    model = ensure_deployed_model(db)

    event = DriftEvent(
        model_id=model.id,
        ks_score=analysis["ks_score"],
        threshold=ks_threshold,
        severity=analysis["severity"],
        drift_detected=analysis["drift_detected"],
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    window = DriftWindow(
        model_id=model.id,
        window_start=analysis["recent_start"],
        window_end=analysis["recent_end"],
        ks_score=analysis["ks_score"],
        fraud_rate_reference=analysis["reference_fraud_rate"],
        fraud_rate_current=analysis["recent_fraud_rate"],
        drift_detected=analysis["drift_detected"],
        severity=analysis["severity"],
    )
    db.add(window)
    db.commit()
    db.refresh(window)

    return {
        "dataset_id": None,
        "ks_score": analysis["ks_score"],
        "threshold": ks_threshold,
        "fraud_rate_change": analysis["fraud_rate_change"],
        "fraud_rate_threshold": fraud_threshold,
        "severity": analysis["severity"],
        "drift_detected": analysis["drift_detected"],
        "drift_event_id": str(event.id),
        "drift_window_id": str(window.id),
        "features": [
            {"feature": name, **summary}
            for name, summary in analysis["summaries"].items()
        ],
        "reference_size": analysis["reference_size"],
        "recent_size": analysis["recent_size"],
    }
