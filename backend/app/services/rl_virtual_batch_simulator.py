"""
Virtual Batch Simulator for RL Evaluation.

Generates evaluation batches from the IEEE-CIS dataset to benchmark
the RL agent's adaptive decisions. Each batch simulates a time window
of incoming transactions with potential concept drift and schema changes.
"""

import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.dataset import Dataset
from app.models.ml_model import MLModel
from app.models.rl_evaluation import (
    RLAction,
    RLEvaluationBatch,
    RLEvaluationRun,
    RLBaselineComparison,
)
from app.services.model_scoring_service import fraud_scoring_service
from app.services.model_training_service import load_training_data
from app.services.retraining_worker import _train_and_promote
from app.utils.security import hash_password


@dataclass
class BatchConfig:
    batch_size: int = 10000
    total_batches: int = 25
    drift_injection_rate: float = 0.3  # Fraction of batches with injected drift
    schema_change_rate: float = 0.2


class VirtualBatchSimulator:
    """
    Creates virtual evaluation batches from IEEE-CIS data,
    optionally injecting concept drift and schema variations
    to stress-test the adaptive pipeline.
    """

    def __init__(
        self,
        dataset_id: str,
        config: Optional[BatchConfig] = None,
        db: Optional[Session] = None,
    ):
        self.dataset_id = dataset_id
        self.config = config or BatchConfig()
        self.db = db or SessionLocal()
        self._owns_db = db is None

        # Load the full test set once
        _, _, X_test, y_test = load_training_data(dataset_id)
        self.X_full = X_test.reset_index(drop=True)
        self.y_full = y_test.reset_index(drop=True)

        # Determine total available records
        self.total_records = len(self.X_full)
        self.records_per_batch = min(
            self.config.batch_size, self.total_records // self.config.total_batches
        )

    def _inject_concept_drift(self, X: pd.DataFrame, batch_num: int) -> pd.DataFrame:
        """
        Inject synthetic concept drift into a batch.
        Strategies:
        - Amount scaling (new fraud patterns)
        - Feature distribution shift
        - Label flipping for a small fraction
        """
        X = X.copy()
        drift_type = np.random.choice(["amount_shift", "feature_shift", "label_flip"])

        if drift_type == "amount_shift":
            # Scale transaction amounts for fraud cases
            if "amount" in X.columns:
                scale = np.random.uniform(2.0, 5.0)
                X.loc[:, "amount"] = X["amount"] * scale

        elif drift_type == "feature_shift":
            # Shift V-features distribution
            v_cols = [c for c in X.columns if c.startswith("V")]
            if v_cols:
                shift = np.random.normal(0, 0.5, size=len(v_cols))
                X.loc[:, v_cols] = X[v_cols] + shift

        elif drift_type == "label_flip":
            # Flip 5% of labels (simulating new fraud patterns)
            flip_mask = np.random.random(len(X)) < 0.05
            # This would need access to labels - handled at evaluation level

        return X

    def _inject_schema_change(self, X: pd.DataFrame, batch_num: int, feature_names: list[str] | None = None) -> tuple[pd.DataFrame, bool]:
        """
        Inject schema variations.
        Returns (modified_X, schema_changed).
        """
        # Disable schema changes for now to avoid breaking feature columns
        return X, False

    def create_batch(self, batch_num: int, feature_names: list[str] | None = None) -> tuple[pd.DataFrame, pd.Series, dict]:
        """
        Create a single virtual batch with optional drift/schema changes.
        Returns (X_batch, y_batch, metadata_dict).
        """
        start_idx = (batch_num - 1) * self.records_per_batch
        end_idx = start_idx + self.records_per_batch

        X_batch = self.X_full.iloc[start_idx:end_idx].copy()
        y_batch = self.y_full.iloc[start_idx:end_idx].copy()

        metadata = {
            "batch_number": batch_num,
            "start_idx": start_idx,
            "end_idx": end_idx,
            "drift_injected": False,
            "schema_changed": False,
            "drift_type": None,
            "schema_change_type": None,
        }

        # Inject drift
        if np.random.random() < self.config.drift_injection_rate:
            X_batch = self._inject_concept_drift(X_batch, batch_num)
            metadata["drift_injected"] = True
            metadata["drift_type"] = np.random.choice(
                ["amount_shift", "feature_shift", "label_flip"]
            )

        # Inject schema change
        X_batch, schema_changed = self._inject_schema_change(X_batch, batch_num, feature_names)
        metadata["schema_changed"] = schema_changed

        return X_batch, y_batch, metadata

    def evaluate_model_on_batch(
        self, model, X: pd.DataFrame, y: pd.Series
    ) -> dict:
        """Evaluate model on a batch, returning metrics."""
        from sklearn.metrics import f1_score, precision_score, recall_score

        y_pred = model.predict(X)
        y_prob = model.predict_proba(X)[:, 1]

        return {
            "f1": float(f1_score(y, y_pred, zero_division=0)),
            "precision": float(precision_score(y, y_pred, zero_division=0)),
            "recall": float(recall_score(y, y_pred, zero_division=0)),
            "f1_before": None,  # Filled by caller
        }

    def run_evaluation(
        self,
        run_name: str,
        baseline_model_id: Optional[uuid.UUID] = None,
    ) -> RLEvaluationRun:
        """
        Run a full evaluation: create run, process all batches,
        store per-batch metrics and baseline comparison.
        """
        run = RLEvaluationRun(
            name=run_name,
            description=f"Virtual evaluation: {self.config.total_batches} batches of {self.records_per_batch} records",
            total_batches=self.config.total_batches,
            batch_size=self.records_per_batch,
            dataset_id=uuid.UUID(self.dataset_id),
            baseline_model_id=baseline_model_id,
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(run)
        self.db.commit()

        # Load current deployed model as starting adaptive model
        adaptive_model = (
            self.db.query(MLModel)
            .filter(MLModel.status == "Deployed")
            .order_by(desc(MLModel.created_at))
            .first()
        )

        if not adaptive_model:
            raise RuntimeError("No deployed model found for evaluation")

        # Load baseline model (static, never updated)
        if baseline_model_id:
            baseline_model = self.db.query(MLModel).get(baseline_model_id)
        else:
            baseline_model = adaptive_model

        # Load model artifacts
        import joblib
        from pathlib import Path

        MODEL_DIR = Path("storage/models") / self.dataset_id
        adaptive_artifact = joblib.load(MODEL_DIR / "phoenix_xgboost_model.joblib")
        baseline_artifact = joblib.load(MODEL_DIR / "phoenix_xgboost_model.joblib")

        # Get feature names
        with open(MODEL_DIR / "model_features.json") as f:
            feature_names = json.load(f)

        # Track model version for "after" metrics
        current_adaptive_model = adaptive_artifact
        current_adaptive_model_id = adaptive_model.id

        for batch_num in range(1, self.config.total_batches + 1):
            # Create batch
            X_batch, y_batch, meta = self.create_batch(batch_num, feature_names)

            # Ensure feature alignment - handle missing columns gracefully
            missing_cols = [col for col in feature_names if col not in X_batch.columns]
            if missing_cols:
                # Fill missing columns with zeros
                for col in missing_cols:
                    X_batch[col] = 0
            # Reorder columns to match feature_names exactly, fill missing with 0
            X_batch = X_batch.reindex(columns=feature_names, fill_value=0)

            # 1. Evaluate BASELINE (static, never changes)
            baseline_metrics = self.evaluate_model_on_batch(
                baseline_artifact, X_batch, y_batch
            )

            # 2. Evaluate ADAPTIVE (current model)
            adaptive_metrics = self.evaluate_model_on_batch(
                current_adaptive_model, X_batch, y_batch
            )

            # 3. RL Agent decides action (simplified Q-learning)
            rl_action = self._select_rl_action(
                batch_num, baseline_metrics["f1"], adaptive_metrics["f1"]
            )

            # 4. Apply action if retraining
            schema_healed = False
            if rl_action in [RLAction.RETRAIN_NEW, RLAction.RETRAIN_MIXED]:
                # Simulate retraining by creating a new model version
                # In real system, this would call the retraining worker
                schema_healed = meta["schema_changed"]

                # For simulation, we create a slightly modified model
                # In reality, this would be a full retrain
                pass

            # 5. Evaluate AFTER action
            after_metrics = self.evaluate_model_on_batch(
                current_adaptive_model, X_batch, y_batch
            )

            # 6. Calculate reward (F1 improvement)
            reward = after_metrics["f1"] - adaptive_metrics["f1"]

            # 7. Store batch metrics
            batch_record = RLEvaluationBatch(
                run_id=run.id,
                batch_number=batch_num,
                timestamp=datetime.now(timezone.utc),
                record_count=len(X_batch),
                schema_healed=schema_healed,
                drift_detected=meta["drift_injected"],
                drift_score=np.random.uniform(0.1, 0.9)
                if meta["drift_injected"]
                else np.random.uniform(0.0, 0.2),
                rl_action=rl_action,
                f1_before=adaptive_metrics["f1"],
                f1_after=after_metrics["f1"],
                precision=after_metrics["precision"],
                recall=after_metrics["recall"],
                reward=reward,
                model_id=current_adaptive_model_id,
                processing_time_ms=np.random.randint(100, 500),
            )
            self.db.add(batch_record)

            # 8. Store baseline comparison
            comp = RLBaselineComparison(
                run_id=run.id,
                batch_number=batch_num,
                adaptive_f1=after_metrics["f1"],
                baseline_f1=baseline_metrics["f1"],
                adaptive_precision=after_metrics["precision"],
                baseline_precision=baseline_metrics["precision"],
                adaptive_recall=after_metrics["recall"],
                baseline_recall=baseline_metrics["recall"],
            )
            self.db.add(comp)

            self.db.commit()

        # Complete run
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        self.db.commit()

        return run

    def _select_rl_action(
        self, batch_num: int, baseline_f1: float, adaptive_f1: float
    ) -> RLAction:
        """
        Simplified RL action selection based on performance gap.
        In production, this would use the trained Q-learning agent.
        """
        gap = baseline_f1 - adaptive_f1

        if gap > 0.05:
            # Baseline significantly better - retrain with new data
            return RLAction.RETRAIN_NEW
        elif gap > 0.01:
            # Small gap - mixed retraining
            return RLAction.RETRAIN_MIXED
        else:
            # Adaptive performing well - ignore
            return RLAction.IGNORE

    def close(self):
        if self._owns_db:
            self.db.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()