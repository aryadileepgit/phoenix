"""
Background adaptive-retraining worker.

Triggered (never automatically per drift event) through
maybe_trigger_from_event(), which enforces every gate:

  1. Q-learning must select RETRAIN_RECENT or FULL_RETRAIN.
     IGNORE ends the chain with a recorded reason.
  2. No other retraining job may be running (single-flight).
  3. A cooldown since the last completed run must have passed.
  4. RETRAIN_RECENT additionally requires a minimum number of
     labeled recent transactions (actual_label IS NOT NULL).

The worker thread trains on IEEE-CIS balanced artifacts plus,
for RETRAIN_RECENT, labeled recent API rows transformed with
the exact live scoring feature pipeline. Output stages to
storage/models/staging/<job_id>/ and is promoted ONLY after
validation beats the deployed model within tolerance:

  new_roc_auc     >= deployed_roc_auc     - tolerance
  new_accuracy    >= deployed_accuracy    - tolerance

On success the worker backs up the active dir, copies staged
files over it, records ModelReport + ml_models + history rows,
and the scorer hot-reloads on its next call. On any failure
or gate rejection the deployed model keeps serving untouched.

Live Kafka prediction never blocks: scoring runs in the API /
consumer processes while training runs here in a thread.
"""

import json
import os
import shutil
import threading
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import desc, text

from app.database.database import SessionLocal
from app.models.drift_event import DriftEvent
from app.models.ml_model import MLModel
from app.models.model_report import ModelReport
from app.models.retraining_history import RetrainingHistory
from app.models.retraining_job import RetrainingJob
from app.models.transaction import Transaction

ACTIVE_DATASET_ID = "f99a1cac-51a4-4d18-9b82-a06d975dd97b"

STAGING_ROOT = Path("storage/models/staging")
BACKUP_ROOT = Path("storage/models/backup")

ACTIVE_DIR = Path("storage/models") / ACTIVE_DATASET_ID

_ARTIFACT_FILES = (
    "phoenix_xgboost_model.joblib",
    "model_features.json",
    "feature_medians.json",
    "model_metadata.json",
)

COOLDOWN_HOURS = float(os.getenv("RETRAIN_COOLDOWN_HOURS", "6"))
MIN_LABELED_RECENT = int(os.getenv("MIN_LABELED_RECENT", "50"))
MAX_REGRESSION = float(os.getenv("RETRAIN_MAX_REGRESSION", "0.02"))
RECENT_LABEL_CAP = int(os.getenv("RETRAIN_RECENT_CAP", "5000"))


_lock = threading.RLock()

_jobs: dict = {}

# Postgres advisory lock guarding model swaps across processes.
# The in-memory single-flight check is not enough when the API
# and consumer run as separate processes.
_ADVISORY_LOCK_KEY = 727171


def _now():
    return datetime.now(timezone.utc)


def _job_snapshot(job):
    return {
        "job_id": job["job_id"],
        "action": job["action"],
        "drift_event_id": job["drift_event_id"],
        "status": job["status"],
        "progress": job["progress"],
        "error": job["error"],
        "started_at": (
            job["started_at"].isoformat()
            if job["started_at"]
            else None
        ),
        "finished_at": (
            job["finished_at"].isoformat()
            if job["finished_at"]
            else None
        ),
    }


def _row_to_snapshot(row):
    return {
        "job_id": row.job_id,
        "action": row.action_taken
        if hasattr(row, "action_taken")
        else row.action,
        "drift_event_id": (
            str(row.drift_event_id)
            if row.drift_event_id
            else None
        ),
        "status": row.status,
        "progress": row.progress,
        "error": row.error,
        "started_at": (
            row.started_at.isoformat()
            if row.started_at
            else None
        ),
        "finished_at": (
            row.finished_at.isoformat()
            if row.finished_at
            else None
        ),
    }


def get_active_job(db=None):
    with _lock:
        for job in _jobs.values():
            if job["status"] in ("queued", "running"):
                return _job_snapshot(job)

    if db is None:
        return None

    row = (
        db.query(RetrainingJob)
        .filter(RetrainingJob.status.in_(["queued", "running"]))
        .order_by(desc(RetrainingJob.created_at))
        .first()
    )

    return _row_to_snapshot(row) if row else None


def list_recent_jobs(db, limit=10):
    rows = (
        db.query(RetrainingJob)
        .order_by(desc(RetrainingJob.created_at))
        .limit(limit)
        .all()
    )
    return [_row_to_snapshot(row) for row in rows]


def get_job(job_id):
    with _lock:
        job = _jobs.get(job_id)
        return _job_snapshot(job) if job else None


def list_recent_jobs(db, limit=10):
    rows = (
        db.query(RetrainingJob)
        .order_by(desc(RetrainingJob.created_at))
        .limit(limit)
        .all()
    )
    return [_row_to_snapshot(row) for row in rows]


def _persist_job(job_id):
    """
    Best-effort write of the in-memory snapshot to the jobs
    table so status and failures survive restarts.
    """

    with _lock:
        job = _jobs.get(job_id)
        snapshot = dict(job) if job else None

    if snapshot is None:
        return

    db = SessionLocal()

    try:
        row = (
            db.query(RetrainingJob)
            .filter(RetrainingJob.job_id == job_id)
            .first()
        )

        payload = {
            "status": snapshot["status"],
            "progress": snapshot["progress"],
            "error": snapshot["error"],
            "started_at": snapshot["started_at"],
            "finished_at": snapshot["finished_at"],
        }

        if row is None:
            row = RetrainingJob(
                job_id=snapshot["job_id"],
                action=snapshot["action"],
                drift_event_id=_as_uuid_or_none(
                    snapshot["drift_event_id"]
                ),
                **payload,
            )
            db.add(row)
        else:
            for key, value in payload.items():
                setattr(row, key, value)

        db.commit()

    except Exception:
        traceback.print_exc()
        try:
            db.rollback()
        except Exception:
            pass

    finally:
        try:
            db.close()
        except Exception:
            pass


def _as_uuid_or_none(value):
    import uuid as uuid_module

    if not value:
        return None

    try:
        return uuid_module.UUID(str(value))
    except (ValueError, AttributeError):
        return None


def _set(job_id, **fields):
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        job.update(fields)

    if "status" in fields or "progress" in fields:
        _persist_job(job_id)


def _labeled_recent_count(db):
    return (
        db.query(Transaction)
        .filter(Transaction.actual_label != None)  # noqa: E711
        .count()
    )


def _cooldown_ok(db):
    if COOLDOWN_HOURS <= 0:
        return True, None

    last = (
        db.query(RetrainingHistory)
        .order_by(desc(RetrainingHistory.completed_at))
        .first()
    )

    if last is None or last.completed_at is None:
        return True, None

    completed = last.completed_at
    if completed.tzinfo is None:
        completed = completed.replace(tzinfo=timezone.utc)

    elapsed_hours = (
        _now() - completed
    ).total_seconds() / 3600.0

    if elapsed_hours < COOLDOWN_HOURS:
        return False, (
            f"Cooldown active: last retraining "
            f"{elapsed_hours:.1f}h ago "
            f"(cooldown {COOLDOWN_HOURS}h)."
        )

    return True, None


def maybe_trigger_from_event(drift_event_id, db):
    """
    Gate a drift event through Q-learning into a background
    job. Returns a plain dict describing the outcome; never
    raises for gate rejections.
    """

    from app.services.qlearning_service import get_q_learning_action

    with _lock:
        for job in _jobs.values():
            if job["status"] in ("queued", "running"):
                return {
                    "triggered": False,
                    "reason": (
                        "A retraining job is already running "
                        f"({job['job_id']})."
                    ),
                    "job_id": job["job_id"],
                    "action": job["action"],
                }

    lingering = (
        db.query(RetrainingJob)
        .filter(RetrainingJob.status.in_(["queued", "running"]))
        .order_by(desc(RetrainingJob.created_at))
        .first()
    )

    if lingering is not None:
        return {
            "triggered": False,
            "reason": (
                "A retraining job is already recorded as "
                f"{lingering.status} ({lingering.job_id})."
            ),
            "job_id": lingering.job_id,
            "action": lingering.action,
        }

    ok, reason = _cooldown_ok(db)
    if not ok:
        return {
            "triggered": False,
            "reason": reason,
            "job_id": None,
            "action": None,
        }

    decision = get_q_learning_action(str(drift_event_id), db)
    action = decision["action"]

    if action == "IGNORE":
        return {
            "triggered": False,
            "reason": (
                "Q-learning selected IGNORE for state "
                f"{decision['state_name']}."
            ),
            "job_id": None,
            "action": action,
            "state": decision["state_name"],
        }

    if action == "RETRAIN_RECENT":
        labeled = _labeled_recent_count(db)
        if labeled < MIN_LABELED_RECENT:
            return {
                "triggered": False,
                "reason": (
                    f"RETRAIN_RECENT needs {MIN_LABELED_RECENT} "
                    f"labeled recent transactions; found "
                    f"{labeled}."
                ),
                "job_id": None,
                "action": action,
                "state": decision["state_name"],
            }

    return start_job(action, str(drift_event_id))


def start_job(action, drift_event_id):
    """
    Enqueue a background retraining job. Single-flight: raises
    RuntimeError if a job is already active. Used by the gate
    above and by operations verification scripts.
    """

    if action not in ("RETRAIN_RECENT", "FULL_RETRAIN"):
        raise ValueError(f"Unknown retraining action: {action}")

    with _lock:
        for job in _jobs.values():
            if job["status"] in ("queued", "running"):
                raise RuntimeError(
                    "A retraining job is already running "
                    f"({job['job_id']})."
                )

        job_id = uuid.uuid4().hex[:12]
        _jobs[job_id] = {
            "job_id": job_id,
            "action": action,
            "drift_event_id": drift_event_id,
            "status": "queued",
            "progress": "Queued.",
            "error": None,
            "started_at": None,
            "finished_at": None,
        }

    _persist_job(job_id)

    thread = threading.Thread(
        target=_run_job,
        args=(job_id,),
        daemon=True,
    )
    thread.start()

    return {
        "triggered": True,
        "job_id": job_id,
        "action": action,
        "state": None,
        "reason": None,
    }


def _run_job(job_id):
    started = time.time()

    _set(
        job_id,
        status="running",
        started_at=_now(),
        progress="Loading training data.",
    )
    _persist_job(job_id)

    db = SessionLocal()
    lock_held = False

    try:
        try:
            lock_held = bool(
                db.execute(
                    text(
                        "SELECT pg_try_advisory_lock(:key)"
                    ),
                    {"key": _ADVISORY_LOCK_KEY},
                ).scalar()
            )
        except Exception:
            lock_held = False

        if not lock_held:
            raise RuntimeError(
                "Another retraining worker holds the "
                "swap lock; refusing to run concurrently."
            )

        result = _train_and_promote(job_id, db)

        _set(
            job_id,
            status="succeeded",
            progress=(
                f"Promoted {result['new_version']} "
                f"(roc_auc={result['roc_auc']:.4f})."
            ),
            finished_at=_now(),
        )
        _persist_job(job_id)

    except Exception as exc:
        traceback.print_exc()

        _set(
            job_id,
            status="failed",
            progress="Failed; deployed model untouched.",
            error=str(exc),
            finished_at=_now(),
        )
        _persist_job(job_id)

        try:
            shutil.rmtree(
                STAGING_ROOT / job_id, ignore_errors=True
            )
        except Exception:
            pass

    finally:
        if lock_held:
            try:
                db.execute(
                    text(
                        "SELECT pg_advisory_unlock(:key)"
                    ),
                    {"key": _ADVISORY_LOCK_KEY},
                )
            except Exception:
                pass

        try:
            db.close()
        except Exception:
            pass

        _jobs[job_id]["duration_seconds"] = round(
            time.time() - started, 1
        )


def _train_and_promote(job_id, db):
    from xgboost import XGBClassifier
    from sklearn.metrics import (
        accuracy_score,
        average_precision_score,
        confusion_matrix,
        f1_score,
        precision_recall_curve,
        precision_score,
        recall_score,
        roc_auc_score,
        roc_curve,
    )
    import joblib
    import pandas as pd

    from app.models.dataset import Dataset
    from app.services.model_training_service import (
        load_training_data,
    )
    from app.services.qlearning_service import calculate_reward

    with _lock:
        action = _jobs[job_id]["action"]
        drift_event_id = _jobs[job_id]["drift_event_id"]

    _set(job_id, progress="Loading IEEE-CIS training data.")

    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == ACTIVE_DATASET_ID)
        .first()
    )

    if dataset is None:
        raise RuntimeError(
            "IEEE-CIS dataset row not found in database."
        )

    X_train, y_train, X_test, y_test = load_training_data(
        ACTIVE_DATASET_ID
    )

    if action == "RETRAIN_RECENT":
        _set(
            job_id,
            progress="Transforming labeled recent transactions.",
        )
        X_train, y_train = _append_labeled_recents(
            db, X_train, y_train
        )

    feature_names = list(X_train.columns)

    _set(
        job_id,
        progress=(
            f"Training XGBoost on {len(X_train)} rows "
            f"({action}). Live scoring continues meanwhile."
        ),
    )

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    _set(job_id, progress="Validating on held-out test set.")

    y_pred = model.predict(X_test)
    y_probability = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(
            precision_score(y_test, y_pred, zero_division=0)
        ),
        "recall": float(
            recall_score(y_test, y_pred, zero_division=0)
        ),
        "f1_score": float(
            f1_score(y_test, y_pred, zero_division=0)
        ),
        "roc_auc": float(roc_auc_score(y_test, y_probability)),
        "pr_auc": float(
            average_precision_score(y_test, y_probability)
        ),
    }

    cm = confusion_matrix(y_test, y_pred)
    fpr, tpr, thresholds = roc_curve(y_test, y_probability)
    pr_precision, pr_recall, pr_thresholds = precision_recall_curve(
        y_test, y_probability
    )
    import numpy as np

    # Downsample to 200 evenly spaced operating points so the
    # curve stays small enough for model_metadata.json while
    # preserving its shape for the frontend chart.
    _pr_idx = np.linspace(
        0, len(pr_precision) - 1, num=min(200, len(pr_precision))
    ).astype(int)
    pr_curve = {
        "precision": [float(pr_precision[i]) for i in _pr_idx],
        "recall": [float(pr_recall[i]) for i in _pr_idx],
        "thresholds": [
            float(pr_thresholds[min(i, len(pr_thresholds) - 1)])
            for i in _pr_idx
        ],
    }
    importance = model.feature_importances_
    feature_importance = sorted(
        [
            {
                "feature": name,
                "importance": float(value),
            }
            for name, value in zip(feature_names, importance)
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )[:20]

    deployed = (
        db.query(MLModel)
        .filter(MLModel.status == "Deployed")
        .order_by(desc(MLModel.created_at))
        .first()
    )

    if deployed is None:
        raise RuntimeError("No deployed model to compare against.")

    deployed_auc = float(deployed.roc_auc or 0.0)
    deployed_acc = float(deployed.accuracy or 0.0)

    if (
        metrics["roc_auc"] < deployed_auc - MAX_REGRESSION
        or metrics["accuracy"] < deployed_acc - MAX_REGRESSION
    ):
        raise RuntimeError(
            f"Validation gate rejected the candidate "
            f"(roc_auc={metrics['roc_auc']:.4f} vs deployed "
            f"{deployed_auc:.4f}, accuracy={metrics['accuracy']:.4f} "
            f"vs {deployed_acc:.4f}). Deployed model kept."
        )

    _set(job_id, progress="Staging candidate artifacts.")

    staging = STAGING_ROOT / job_id
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    medians = X_train.median(numeric_only=True)

    joblib.dump(model, staging / "phoenix_xgboost_model.joblib")

    with open(staging / "model_features.json", "w") as f:
        json.dump(feature_names, f)

    with open(staging / "feature_medians.json", "w") as f:
        json.dump(
            {k: float(v) for k, v in medians.items()}, f
        )

    metadata = {
        "dataset_id": ACTIVE_DATASET_ID,
        "model_name": "Phoenix XGBoost Fraud Detector",
        "algorithm": "XGBoost",
        "training_rows": int(len(X_train)),
        "testing_rows": int(len(X_test)),
        "features": int(len(feature_names)),
        "n_estimators": 300,
        "max_depth": 6,
        "learning_rate": 0.08,
        "subsample": 0.85,
        "colsample_bytree": 0.85,
        "retraining_action": action,
        "retraining_job_id": job_id,
        "drift_event_id": drift_event_id,
        "trained_at": _now().isoformat(),
        **metrics,
        "pr_curve": _json_safe(pr_curve),
    }

    with open(staging / "model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)

    _set(job_id, progress="Promoting candidate (backup first).")

    timestamp = _now().strftime("%Y%m%d_%H%M%S")
    backup = BACKUP_ROOT / f"{timestamp}_{job_id}"
    backup.mkdir(parents=True)

    def register():
        new_version = _bump_version(deployed.version)

        new_model = MLModel(
            model_name="Phoenix XGBoost Fraud Detector",
            algorithm="XGBoost",
            version=new_version,
            accuracy=metrics["accuracy"],
            precision=metrics["precision"],
            recall=metrics["recall"],
            f1_score=metrics["f1_score"],
            roc_auc=metrics["roc_auc"],
            model_path=str(
                ACTIVE_DIR / "phoenix_xgboost_model.joblib"
            ),
            trained_on_dataset=ACTIVE_DATASET_ID,
            status="Deployed",
        )
        db.add(new_model)

        deployed.status = "Superseded"

        report = ModelReport(
            dataset_id=dataset.id,
            model_name="Phoenix XGBoost Fraud Detector",
            accuracy=metrics["accuracy"],
            precision=metrics["precision"],
            recall=metrics["recall"],
            f1_score=metrics["f1_score"],
            roc_auc=metrics["roc_auc"],
            train_rows=int(len(X_train)),
            test_rows=int(len(X_test)),
            confusion_matrix=_json_safe(
                {
                    "labels": ["Legitimate", "Fraud"],
                    "matrix": cm.tolist(),
                }
            ),
            roc_curve=_json_safe(
                {
                    "fpr": [float(v) for v in fpr],
                    "tpr": [float(v) for v in tpr],
                    "thresholds": [float(v) for v in thresholds],
                }
            ),
            feature_importance=_json_safe(feature_importance),
            model_path=str(
                ACTIVE_DIR / "phoenix_xgboost_model.joblib"
            ),
            is_best_model=True,
            status="Completed",
        )
        db.add(report)
        db.commit()

        try:
            reward = calculate_reward(
                action, metrics["roc_auc"], deployed_auc
            )
        except Exception:
            reward = 0.0

        history = RetrainingHistory(
            drift_event_id=drift_event_id,
            old_model_id=deployed.id,
            new_model_id=new_model.id,
            action_taken=action,
            reward=reward,
            training_duration=int(
                _jobs[job_id].get("duration_seconds", 0) or 0
            ),
            completed_at=_now(),
        )
        db.add(history)
        db.commit()

        return new_version

    new_version = _promote_candidate(
        staging, backup, ACTIVE_DIR, register, db=db
    )

    shutil.rmtree(staging, ignore_errors=True)

    return {
        "roc_auc": metrics["roc_auc"],
        "new_version": new_version,
    }


def _append_labeled_recents(db, X_train, y_train):
    import pandas as pd

    from app.services.model_scoring_service import (
        FraudScoringService,
    )

    rows = (
        db.query(Transaction)
        .filter(Transaction.actual_label != None)  # noqa: E711
        .order_by(Transaction.created_at.desc())
        .limit(RECENT_LABEL_CAP)
        .all()
    )

    if not rows:
        return X_train, y_train

    scorer = FraudScoringService()

    frames = []
    labels = []

    for row in rows:
        payload = {
            "transaction_id": row.transaction_id,
            "account_id": row.account_id,
            "amount": float(row.amount),
            "transaction_time": (
                row.transaction_time.isoformat()
                if row.transaction_time
                else None
            ),
            "product_code": row.product_code,
            "card_information": row.card_information or {},
            "device_information": row.device_information or {},
            "additional_data": row.additional_data or {},
        }

        try:
            features = scorer._build_features(payload)
            processed = scorer._preprocess(features)
        except Exception:
            continue

        frames.append(processed)
        labels.append(1 if row.actual_label is True else 0)

    if not frames:
        return X_train, y_train

    recent = pd.concat(frames, ignore_index=True)
    recent = recent.reindex(columns=X_train.columns)
    recent = recent.apply(pd.to_numeric, errors="coerce")

    combined_X = pd.concat([X_train, recent], ignore_index=True)
    combined_y = pd.concat(
        [
            y_train,
            pd.Series(labels, dtype=int),
        ],
        ignore_index=True,
    )

    medians = combined_X.median(numeric_only=True)
    combined_X = combined_X.fillna(medians).fillna(0)

    return combined_X, combined_y


def _json_safe(value):
    """
    Postgres JSONB rejects Infinity/NaN tokens (sklearn's
    roc_curve emits an infinite first threshold), so replace
    non-finite floats with None before persisting reports.
    """

    import math

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]

    return value


def _promote_candidate(staging, backup, active_dir, register, db=None):
    """
    Copy staged artifacts over the active model dir, hot-reload
    the scorer, then run register() for the DB records. ANY
    failure at ANY step rolls back the session, restores the
    backup and reloads again, so the previously deployed model
    keeps serving untouched. Returns register()'s return value.
    """

    for name in _ARTIFACT_FILES:
        source = Path(active_dir) / name
        if source.exists():
            shutil.copy2(source, Path(backup) / name)

    try:
        for name in _ARTIFACT_FILES:
            shutil.copy2(
                Path(staging) / name, Path(active_dir) / name
            )

        from app.services.model_scoring_service import (
            fraud_scoring_service,
        )

        fraud_scoring_service.reload_if_updated()

        return register()

    except Exception:
        if db is not None:
            try:
                db.rollback()
            except Exception:
                pass

        for name in _ARTIFACT_FILES:
            restored = Path(backup) / name
            if restored.exists():
                shutil.copy2(restored, Path(active_dir) / name)

        try:
            from app.services.model_scoring_service import (
                fraud_scoring_service,
            )

            fraud_scoring_service.reload_if_updated()
        except Exception:
            pass

        raise


def _bump_version(version):
    try:
        major, minor = str(version or "1.0").split(".")
        return f"{int(major)}.{int(minor) + 1}"
    except (ValueError, AttributeError):
        return "1.1"
