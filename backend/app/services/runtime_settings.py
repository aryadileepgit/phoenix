"""
Runtime-tunable Phoenix settings.

Thresholds used to be hardcoded in the scoring and schema code.
They now resolve through this module so GET/PUT /settings is
real: PUT persists validated overrides to storage/settings.json
and every consumer reads them through the getters below.

Defaults preserve the original behavior:
  verify_threshold = 0.30, fraud_threshold = 0.70
  min_confidence   = 0.70
  drift ks threshold = 0.05, fraud-rate threshold = 0.10
"""

import json
from pathlib import Path


SETTINGS_PATH = Path("storage/settings.json")

DEFAULTS = {
    "fraud_threshold": 0.70,
    "verify_threshold": 0.30,
    "min_confidence": 0.70,
    "drift_ks_threshold": 0.05,
    "drift_fraud_rate_threshold": 0.10,
}

_cache = None


def _read_overrides():
    global _cache

    if _cache is not None:
        return _cache

    _cache = {}

    try:

        if SETTINGS_PATH.exists():

            raw = json.loads(
                SETTINGS_PATH.read_text(encoding="utf-8")
            )

            if isinstance(raw, dict):
                _cache = raw

    except (OSError, ValueError):

        _cache = {}

    return _cache


def invalidate_cache():
    global _cache
    _cache = None


def get_setting(name: str):
    overrides = _read_overrides()

    value = overrides.get(name, DEFAULTS[name])

    try:
        return float(value)
    except (TypeError, ValueError):
        return DEFAULTS[name]


def get_thresholds():
    """
    Returns (verify_threshold, fraud_threshold) with the
    invariant verify < fraud, falling back to defaults.
    """

    verify = get_setting("verify_threshold")
    fraud = get_setting("fraud_threshold")

    if not 0.0 < verify < fraud < 1.0:
        return (
            DEFAULTS["verify_threshold"],
            DEFAULTS["fraud_threshold"],
        )

    return verify, fraud


def get_min_confidence():
    value = get_setting("min_confidence")

    if not 0.0 < value <= 1.0:
        return DEFAULTS["min_confidence"]

    return value


def get_drift_thresholds():
    ks_value = get_setting("drift_ks_threshold")
    fraud_value = get_setting("drift_fraud_rate_threshold")

    if not 0.0 < ks_value < 1.0:
        ks_value = DEFAULTS["drift_ks_threshold"]

    if not 0.0 < fraud_value < 1.0:
        fraud_value = DEFAULTS["drift_fraud_rate_threshold"]

    return ks_value, fraud_value


def save_overrides(updates: dict):
    """
    Validates and persists a partial settings update.
    Raises ValueError on invalid values.
    """

    allowed = set(DEFAULTS.keys())

    unknown = set(updates.keys()) - allowed

    if unknown:
        raise ValueError(
            f"Unknown settings: {sorted(unknown)}"
        )

    merged = dict(DEFAULTS)
    merged.update(_read_overrides())
    merged.update(updates)

    verify = float(merged["verify_threshold"])
    fraud = float(merged["fraud_threshold"])
    confidence = float(merged["min_confidence"])
    ks_value = float(merged["drift_ks_threshold"])
    fraud_rate_value = float(
        merged["drift_fraud_rate_threshold"]
    )

    if not 0.0 < verify < fraud < 1.0:
        raise ValueError(
            "Require 0 < verify_threshold < fraud_threshold < 1."
        )

    if not 0.0 < confidence <= 1.0:
        raise ValueError(
            "Require 0 < min_confidence <= 1."
        )

    if not 0.0 < ks_value < 1.0:
        raise ValueError(
            "Require 0 < drift_ks_threshold < 1."
        )

    if not 0.0 < fraud_rate_value < 1.0:
        raise ValueError(
            "Require 0 < drift_fraud_rate_threshold < 1."
        )

    SETTINGS_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    SETTINGS_PATH.write_text(
        json.dumps(
            {
                "fraud_threshold": fraud,
                "verify_threshold": verify,
                "min_confidence": confidence,
                "drift_ks_threshold": ks_value,
                "drift_fraud_rate_threshold": fraud_rate_value,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    invalidate_cache()

    return current_settings()


def current_settings():
    verify, fraud = get_thresholds()
    ks_value, fraud_rate_value = get_drift_thresholds()

    return {
        "fraud_threshold": fraud,
        "verify_threshold": verify,
        "min_confidence": get_min_confidence(),
        "drift_ks_threshold": ks_value,
        "drift_fraud_rate_threshold": fraud_rate_value,
    }
