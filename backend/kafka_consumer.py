"""
Phoenix Kafka consumer: phoenix-transactions -> XGBoost -> PostgreSQL.

Consumes raw simulator payloads (txn_id, customer_account,
transaction_amount, ...) from the `phoenix-transactions` topic
and runs each through the IDENTICAL pipeline as
POST /transactions/score:

  schema evolution -> TransactionCreate validation ->
  fraud_scoring_service.score (trained XGBoost) -> persist

It never retrains the model and never fabricates predictions.

At-least-once semantics: offsets commit only after a message is
persisted or deterministically skipped (duplicate transaction_id,
unmapped fields, validation failure). Unexpected errors roll back
without committing so the record is redelivered.

Run from backend/:
    venv\\Scripts\\python.exe kafka_consumer.py

Environment:
    KAFKA_BOOTSTRAP_SERVERS (default localhost:9092)
    KAFKA_TOPIC             (default phoenix-transactions)
    KAFKA_GROUP_ID          (default phoenix-scoring-group)
"""

import json
import logging
import os
import sys

from kafka import KafkaConsumer
from kafka.errors import KafkaError
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.database.database import SessionLocal
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate
from app.services.model_scoring_service import fraud_scoring_service
from app.services.schema_evolution_service import (
    schema_evolution_service,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger("phoenix-kafka-consumer")


BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092",
).split(",")

TOPIC = os.getenv("KAFKA_TOPIC", "phoenix-transactions")

GROUP_ID = os.getenv("KAFKA_GROUP_ID", "phoenix-scoring-group")


def score_and_persist(db, incoming):
    """
    Returns (action, detail) where action is one of
    "persisted", "duplicate", "unmapped", "invalid".
    Raises on unexpected failures (caller rolls back).
    """

    evolution_result = (
        schema_evolution_service.normalize_transaction(incoming)
    )

    if evolution_result["unmapped_fields"]:
        return (
            "unmapped",
            evolution_result["unmapped_fields"],
        )

    try:
        transaction = TransactionCreate.model_validate(
            evolution_result["canonical_transaction"]
        )
    except ValidationError as exc:
        return ("invalid", str(exc))

    existing = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_id
            == transaction.transaction_id
        )
        .first()
    )

    if existing is not None:
        return ("duplicate", transaction.transaction_id)

    scoring_result = fraud_scoring_service.score(
        transaction.model_dump()
    )

    row = Transaction(
        transaction_id=transaction.transaction_id,
        account_id=transaction.account_id,
        amount=transaction.amount,
        transaction_time=transaction.transaction_time,
        product_code=transaction.product_code,
        card_information=transaction.card_information,
        device_information=transaction.device_information,
        additional_data=transaction.additional_data,
        fraud_probability=scoring_result["fraud_probability"],
        predicted_label=scoring_result["predicted_label"],
        risk_level=scoring_result["risk_level"],
        decision=scoring_result["decision"],
    )

    db.add(row)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return ("duplicate", transaction.transaction_id)

    return ("persisted", scoring_result)


def handle_message(db, incoming):
    try:
        action, detail = score_and_persist(db, incoming)
    except Exception:
        db.rollback()
        raise

    if action == "persisted":
        logger.info(
            "scored %s prob=%s risk=%s decision=%s",
            detail.get("transaction_id")
            if isinstance(detail, dict)
            else incoming.get("txn_id"),
            detail.get("fraud_probability"),
            detail.get("risk_level"),
            detail.get("decision"),
        )
    else:
        logger.warning(
            "skipped %s (%s): %s",
            incoming.get("txn_id"),
            action,
            detail,
        )


def main():
    logger.info(
        "connecting to Kafka at %s, topic '%s', group '%s'",
        ",".join(BOOTSTRAP_SERVERS),
        TOPIC,
        GROUP_ID,
    )

    try:
        consumer = KafkaConsumer(
            TOPIC,
            bootstrap_servers=BOOTSTRAP_SERVERS,
            group_id=GROUP_ID,
            auto_offset_reset="latest",
            enable_auto_commit=False,
            value_deserializer=lambda raw: json.loads(
                raw.decode("utf-8")
            ),
        )
    except KafkaError as exc:
        logger.error("could not connect to Kafka: %s", exc)
        sys.exit(1)

    logger.info("consumer running; Ctrl+C to stop.")

    try:
        for message in consumer:
            incoming = message.value

            if not isinstance(incoming, dict):
                logger.warning(
                    "skipping non-object payload at offset %s",
                    message.offset,
                )
                consumer.commit()
                continue

            db = SessionLocal()

            try:
                handle_message(db, incoming)
            except Exception as exc:
                logger.error(
                    "scoring failed at offset %s (%s); "
                    "offset NOT committed, will retry",
                    message.offset,
                    exc,
                )
                continue
            finally:
                db.close()

            consumer.commit()

    except KeyboardInterrupt:
        logger.info("stopping consumer.")

    finally:
        consumer.close()


if __name__ == "__main__":
    main()
