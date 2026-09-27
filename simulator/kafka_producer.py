"""
Phoenix Kafka producer for simulated banking transactions.

Publishes the raw simulator payload (txn_id, customer_account,
transaction_amount, ...) as JSON to the `phoenix-transactions`
topic. Keyed by transaction ID so all records for one
transaction land in the same partition.

The Phoenix Kafka consumer performs schema evolution, XGBoost
scoring, and PostgreSQL persistence — the identical pipeline
as POST /transactions/score. This module only transports; it
never scores and never fabricates model outputs.
"""

import json

from kafka import KafkaProducer
from kafka.errors import KafkaError

from config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_TOPIC,
)


_producer = None


def get_producer():
    """
    Lazy singleton. Raises the underlying KafkaError when no
    broker is reachable so callers can fall back to HTTP.
    """

    global _producer

    if _producer is None:

        _producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(","),
            key_serializer=lambda key: (
                key.encode("utf-8") if key else None
            ),
            value_serializer=lambda value: json.dumps(
                value
            ).encode("utf-8"),
            acks=1,
            retries=5,
            linger_ms=10,
        )

    return _producer


def publish_transaction(transaction):
    """
    Publish one simulator transaction. Returns Kafka
    RecordMetadata on success; raises KafkaError otherwise.
    """

    producer = get_producer()

    future = producer.send(
        KAFKA_TOPIC,
        key=transaction.get("txn_id"),
        value=transaction,
    )

    return future.get(timeout=30)


def close_producer():
    global _producer

    if _producer is not None:

        try:
            _producer.flush(timeout=10)
        finally:
            _producer.close(timeout=10)
            _producer = None
