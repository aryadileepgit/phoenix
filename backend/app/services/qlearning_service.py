import os
import random
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.qlearning_state import QLearningState
from app.models.drift_event import DriftEvent

STATE_SPACE = {
    "drift_severity": ["LOW", "MEDIUM", "HIGH"],
    "fraud_rate_change": ["STABLE", "INCREASING", "DECREASING"],
    "model_age": ["NEW", "AGING", "OLD"],
}

ACTIONS = ["IGNORE", "RETRAIN_RECENT", "FULL_RETRAIN"]

ALPHA = 0.1
GAMMA = 0.95
EPSILON = 0.1

INITIAL_Q_VALUE = 0.0


def _get_state_name(drift_severity: str, fraud_rate_change: str, model_age: str) -> str:
    return f"{drift_severity}_{fraud_rate_change}_{model_age}"


def _initialize_q_table(db: Session):
    for ds in STATE_SPACE["drift_severity"]:
        for fr in STATE_SPACE["fraud_rate_change"]:
            for ma in STATE_SPACE["model_age"]:
                state_name = _get_state_name(ds, fr, ma)
                for action in ACTIONS:
                    existing = (
                        db.query(QLearningState)
                        .filter(
                            QLearningState.state_name == state_name,
                            QLearningState.action_taken == action,
                        )
                        .first()
                    )
                    if existing is None:
                        q_state = QLearningState(
                            state_name=state_name,
                            action_taken=action,
                            reward=0.0,
                            q_value=INITIAL_Q_VALUE,
                            next_state=None,
                        )
                        db.add(q_state)
    db.commit()


def _get_q_values(state_name: str, db: Session) -> dict[str, float]:
    q_records = (
        db.query(QLearningState)
        .filter(QLearningState.state_name == state_name)
        .all()
    )
    if not q_records:
        _initialize_q_table(db)
        q_records = (
            db.query(QLearningState)
            .filter(QLearningState.state_name == state_name)
            .all()
        )
    return {r.action_taken: float(r.q_value) for r in q_records}


def _select_action(q_values: dict[str, float]) -> str:
    if random.random() < EPSILON:
        return random.choice(ACTIONS)
    return max(q_values, key=q_values.get)


def calculate_reward(action: str, new_model_performance: float, old_model_performance: float) -> float:
    improvement = new_model_performance - old_model_performance
    if action == "IGNORE":
        if improvement > 0:
            return round(improvement * 0.5, 4)
        return round(improvement, 4)
    elif action == "RETRAIN_RECENT":
        if improvement > 0:
            return round(improvement * 1.5, 4)
        return round(improvement * 0.8, 4)
    elif action == "FULL_RETRAIN":
        if improvement > 0:
            return round(improvement * 2.0, 4)
        return round(improvement * 0.5, 4)
    return round(improvement, 4)


def get_q_learning_action(
    drift_event_id: str,
    db: Session,
    fraud_rate_change: Optional[str] = None,
    model_age: Optional[str] = None,
) -> dict:
    drift_event = (
        db.query(DriftEvent)
        .filter(DriftEvent.id == drift_event_id)
        .first()
    )
    if drift_event is None:
        raise HTTPException(status_code=404, detail="Drift event not found.")

    if fraud_rate_change is None:
        from app.services.runtime_settings import (
            get_drift_thresholds,
        )

        ks_threshold, _ = get_drift_thresholds()

        fraud_rate_change = (
            "INCREASING"
            if float(drift_event.ks_score) > ks_threshold
            else "STABLE"
        )

    if model_age is None:
        model_age = "NEW"

    drift_severity = drift_event.severity
    state_name = _get_state_name(drift_severity, fraud_rate_change, model_age)

    _initialize_q_table(db)

    q_values = _get_q_values(state_name, db)
    action = _select_action(q_values)

    q_records = (
        db.query(QLearningState)
        .filter(
            QLearningState.state_name == state_name,
            QLearningState.action_taken == action,
        )
        .all()
    )

    for record in q_records:
        current_q = float(record.q_value or 0.0)
        record.q_value = round(
            current_q
            + ALPHA
            * (
                0.0
                + GAMMA * max(q_values.values())
                - current_q
            ),
            6,
        )

    db.commit()
    db.refresh(q_records[0]) if q_records else None

    updated_q_values = _get_q_values(state_name, db)

    return {
        "state_name": state_name,
        "drift_severity": drift_severity,
        "fraud_rate_change": fraud_rate_change,
        "model_age": model_age,
        "action": action,
        "q_values": updated_q_values,
        "epsilon": EPSILON,
    }


def update_q_values(
    state_name: str,
    action: str,
    reward: float,
    next_state: Optional[str],
    db: Session,
):
    _initialize_q_table(db)
    q_records = (
        db.query(QLearningState)
        .filter(
            QLearningState.state_name == state_name,
            QLearningState.action_taken == action,
        )
        .all()
    )
    for record in q_records:
        next_q = (
            max(
                [
                    r.q_value
                    for r in db.query(QLearningState)
                    .filter(QLearningState.state_name == next_state)
                    .all()
                ],
                default=0.0,
            )
            if next_state
            else 0.0
        )
        current_q = float(record.q_value or 0.0)
        new_q = current_q + ALPHA * (
            float(reward) + GAMMA * float(next_q) - current_q
        )
        record.q_value = round(new_q, 6)
        record.reward = round(float(reward), 6)
        if next_state:
            record.next_state = next_state
    db.commit()
