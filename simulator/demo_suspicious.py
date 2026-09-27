"""
Demo Suspicious Mode for Phoenix demonstrations.

Periodically replaces a normally generated transaction with a
realistic suspicious pattern built ONLY from IEEE-CIS dataset
features. Nothing here sets fraud labels or probabilities: the
payload travels the normal Kafka -> consumer -> preprocessing ->
trained XGBoost -> PostgreSQL path and the MODEL decides the
final fraud probability, prediction, risk level, and decision.

Calibration (verified live against the trained model via the
non-persisting /transactions/explain endpoint, 6 randomized
variations per scenario, all values in-distribution per the
raw train_transaction.csv descriptives):

  HIGH   0.81 - 0.91  (BLOCK)   default rate 1 per 500
  MED_A  0.55 - 0.60  (VERIFY)  part of 3 per 500
  MED_B  0.34 - 0.35  (VERIFY)  part of 3 per 500
  normal ~0.04        (APPROVE)

Levers used (all genuine IEEE-CIS columns):
  C14 = 0      (6% of training rows: sparse count history)
  C1  = 4 - 7  (within observed range, median 1)
  V306/V317    (modest positive values, far below maxima)
  P_emaildomain protonmail.com (real anonymized-style domain)
  night hours, high-but-in-tail amounts, new device ids.

Configuration (environment):
  DEMO_SUSPICIOUS_MODE=true|false   default true
  DEMO_HIGH_PROB=0.002              default ~1 per 500
  DEMO_MEDIUM_PROB=0.006            default ~3 per 500
  DEMO_SEED=<int>                   optional, for reproducible
                                    demo rates (default unset)
"""

import os
import random as _stdlib_random


def _env_bool(name, default):
    raw = os.getenv(name)

    if raw is None:
        return default

    return raw.strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _env_prob(name, default):
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default

    if not 0.0 <= value <= 1.0:
        return default

    return value


DEMO_SUSPICIOUS_MODE = _env_bool(
    "DEMO_SUSPICIOUS_MODE",
    True,
)

HIGH_PROBABILITY = _env_prob("DEMO_HIGH_PROB", 0.002)

MEDIUM_PROBABILITY = _env_prob("DEMO_MEDIUM_PROB", 0.006)

_seed_raw = os.getenv("DEMO_SEED")

_rng = (
    _stdlib_random.Random(int(_seed_raw))
    if _seed_raw is not None and _seed_raw.strip().lstrip("-").isdigit()
    else _stdlib_random
)


def roll_scenario():
    """
    Returns "HIGH", "MEDIUM", or None for one generated
    transaction. Pure probability math; calibrated so 500
    transactions yield ~1 HIGH and ~3 MEDIUM in expectation.
    """

    if not DEMO_SUSPICIOUS_MODE:
        return None

    roll = _rng.random()

    if roll < HIGH_PROBABILITY:
        return "HIGH"

    if roll < HIGH_PROBABILITY + MEDIUM_PROBABILITY:
        return "MEDIUM"

    return None


def _night_time():
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    return now.replace(
        hour=_rng.randint(1, 4),
        minute=_rng.randint(0, 59),
        second=_rng.randint(0, 59),
        microsecond=0,
    ).isoformat()


def _evening_time():
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    return now.replace(
        hour=_rng.randint(21, 23),
        minute=_rng.randint(0, 59),
        second=_rng.randint(0, 59),
        microsecond=0,
    ).isoformat()


def apply_high_pattern(transaction):
    """
    Unusual high-value night purchase on sparse history.
    Verified band: 0.81 - 0.91 (HIGH / BLOCK).
    """

    additional = dict(transaction.get("additional_data") or {})

    additional.update(
        {
            "C14": 0.0,
            "V306": round(_rng.uniform(2.5, 4.0), 2),
            "C1": float(_rng.randint(4, 7)),
            "V317": round(_rng.uniform(2.0, 4.0), 2),
            "P_emaildomain": "protonmail.com",
            "scenario": "DEMO_SUSPICIOUS_HIGH",
        }
    )

    transaction["transaction_amount"] = round(
        _rng.uniform(15000, 28000), 2
    )
    transaction["transaction_time"] = _night_time()
    transaction["product"] = _rng.choice(["C", "H"])

    # Preserve the original device_id: downstream history
    # tracking and display code require it, and a new device
    # is expressed through DeviceInfo/device_known instead.
    # (Dropping this key previously crashed the simulator
    # with KeyError: 'device_id'.)
    previous_device = (
        transaction.get("device_information") or {}
    )

    transaction["device_information"] = {
        "device_id": previous_device.get("device_id"),
        "DeviceType": "mobile",
        "DeviceInfo": f"DEV_{_rng.randint(9000, 9999)}",
        "device_known": False,
    }
    transaction["additional_data"] = additional

    return transaction


def apply_medium_pattern(transaction):
    """
    One of two verified MEDIUM patterns, chosen at random:
      A: sparse history + elevated V317 (band 0.55 - 0.60)
      B: elevated V306 night spend   (band 0.34 - 0.35)
    """

    if _rng.random() < 0.5:
        additional = dict(transaction.get("additional_data") or {})

        additional.update(
            {
                "C14": 0.0,
                "V317": round(_rng.uniform(2.0, 4.0), 2),
                "scenario": "DEMO_SUSPICIOUS_MEDIUM_A",
            }
        )

        transaction["transaction_amount"] = round(
            _rng.uniform(3000, 8000), 2
        )
        transaction["transaction_time"] = _evening_time()
        transaction["product"] = "C"
        transaction["additional_data"] = additional

    else:
        additional = dict(transaction.get("additional_data") or {})

        additional.update(
            {
                "V306": round(_rng.uniform(2.5, 4.0), 2),
                "scenario": "DEMO_SUSPICIOUS_MEDIUM_B",
            }
        )

        transaction["transaction_amount"] = round(
            _rng.uniform(10000, 18000), 2
        )
        transaction["transaction_time"] = _night_time()
        transaction["product"] = _rng.choice(["C", "H"])
        transaction["additional_data"] = additional

    return transaction


def maybe_apply_demo_pattern(transaction):
    """
    Layer the calibrated demo patterns over a normally
    generated transaction. Returns (transaction, demo_label)
    where demo_label is None for untouched traffic.
    """

    tier = roll_scenario()

    if tier == "HIGH":
        return apply_high_pattern(transaction), "HIGH"

    if tier == "MEDIUM":
        return apply_medium_pattern(transaction), "MEDIUM"

    return transaction, None
