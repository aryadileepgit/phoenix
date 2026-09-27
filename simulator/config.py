import os


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


API_URL = os.getenv(
    "PHOENIX_API_URL",
    "http://127.0.0.1:1992",
)

TRANSACTION_SCORE_ENDPOINT = (
    f"{API_URL}/transactions/score"
)

TRANSACTION_INTERVAL_SECONDS = int(
    os.getenv("TRANSACTION_INTERVAL_SECONDS", "5")
)

ACCOUNT_HISTORY_FILE = os.getenv(
    "ACCOUNT_HISTORY_FILE",
    "account_history.json",
)

# --------------------------------------------------
# Kafka transport (Simulator -> phoenix-transactions)
# --------------------------------------------------

KAFKA_ENABLED = _env_bool("KAFKA_ENABLED", True)

KAFKA_BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092",
)

KAFKA_TOPIC = os.getenv(
    "KAFKA_TOPIC",
    "phoenix-transactions",
)