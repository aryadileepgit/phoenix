import json
import os
import random
import time
import uuid
from datetime import datetime, timezone

import requests

from config import (
    TRANSACTION_SCORE_ENDPOINT,
    TRANSACTION_INTERVAL_SECONDS,
    ACCOUNT_HISTORY_FILE,
    KAFKA_ENABLED,
    KAFKA_TOPIC,
)


ACCOUNTS = [
    {
        "account_id": "ACC_10001",
        "device_id": "DEV_1001",
        "card_id": "CARD_1001",
        "usual_amount": 800,
        "usual_city": "Kochi",
    },
    {
        "account_id": "ACC_10002",
        "device_id": "DEV_1002",
        "card_id": "CARD_1002",
        "usual_amount": 1500,
        "usual_city": "Kottayam",
    },
    {
        "account_id": "ACC_10003",
        "device_id": "DEV_1003",
        "card_id": "CARD_1003",
        "usual_amount": 2200,
        "usual_city": "Kozhikode",
    },
    {
        "account_id": "ACC_10004",
        "device_id": "DEV_1004",
        "card_id": "CARD_1004",
        "usual_amount": 500,
        "usual_city": "Thrissur",
    },
    {
        "account_id": "ACC_10005",
        "device_id": "DEV_1005",
        "card_id": "CARD_1005",
        "usual_amount": 3000,
        "usual_city": "Thiruvananthapuram",
    },
]


PRODUCTS = [
    "W",
    "H",
    "C",
    "S",
    "R",
]


CITIES = [
    "Kochi",
    "Kottayam",
    "Kozhikode",
    "Thrissur",
    "Thiruvananthapuram",
]


def load_account_history():

    if not os.path.exists(ACCOUNT_HISTORY_FILE):

        history = {}

        for account in ACCOUNTS:

            history[
                account["account_id"]
            ] = {
                "transaction_count": 0,
                "total_amount": 0.0,
                "average_amount": 0.0,
                "usual_city": account[
                    "usual_city"
                ],
                "usual_device": account[
                    "device_id"
                ],
                "last_transaction_time": None,
            }

        save_account_history(history)

        return history

    with open(
        ACCOUNT_HISTORY_FILE,
        "r",
    ) as file:

        return json.load(file)


def save_account_history(history):

    with open(
        ACCOUNT_HISTORY_FILE,
        "w",
    ) as file:

        json.dump(
            history,
            file,
            indent=4,
        )


account_history = load_account_history()


def select_account():

    return random.choice(ACCOUNTS)


def generate_transaction():

    account = select_account()

    account_id = account["account_id"]

    profile = account_history[
        account_id
    ]

    transaction_id = (
        f"SIM_{uuid.uuid4().hex[:10].upper()}"
    )

    average_amount = profile[
        "average_amount"
    ]

    if average_amount == 0:

        normal_amount = account[
            "usual_amount"
        ]

    else:

        normal_amount = average_amount

    scenario = random.choices(
        [
            "NORMAL",
            "UNUSUAL_AMOUNT",
            "NEW_DEVICE",
            "UNUSUAL_LOCATION",
            "RAPID_TRANSACTION",
        ],
        weights=[
            70,
            10,
            7,
            7,
            6,
        ],
        k=1,
    )[0]

    amount = round(
        random.uniform(
            normal_amount * 0.7,
            normal_amount * 1.3,
        ),
        2,
    )

    device_id = profile[
        "usual_device"
    ]

    city = profile[
        "usual_city"
    ]

    transaction_frequency = random.randint(
        1,
        3,
    )

    if scenario == "UNUSUAL_AMOUNT":

        amount = round(
            random.uniform(
                normal_amount * 5,
                normal_amount * 15,
            ),
            2,
        )

    elif scenario == "NEW_DEVICE":

        device_id = (
            f"DEV_{random.randint(9000, 9999)}"
        )

    elif scenario == "UNUSUAL_LOCATION":

        unusual_cities = [
            item
            for item in CITIES
            if item != profile["usual_city"]
        ]

        city = random.choice(
            unusual_cities
        )

    elif scenario == "RAPID_TRANSACTION":

        transaction_frequency = random.randint(
            8,
            15,
        )

    card_information = {
        "card_id": account[
            "card_id"
        ],
        "card_present": True,
    }

    device_information = {
        "device_id": device_id,
        "device_known": (
            device_id
            == profile["usual_device"]
        ),
    }

    additional_data = {
        "city": city,
        "usual_city": profile[
            "usual_city"
        ],
        "transaction_frequency": (
            transaction_frequency
        ),
        "scenario": scenario,
        "previous_transaction_count": (
            profile["transaction_count"]
        ),
        "previous_average_amount": round(
            profile["average_amount"],
            2,
        ),
    }

    transaction_time = datetime.now(
        timezone.utc
    ).isoformat()

    transaction = {
        "txn_id": transaction_id,
        "customer_account": account_id,
        "transaction_amount": amount,
        "transaction_time": transaction_time,
        "product": random.choice(
            PRODUCTS
        ),
        "card_information": (
            card_information
        ),
        "device_information": (
            device_information
        ),
        "additional_data": (
            additional_data
        ),
    }

    # --------------------------------------------------
    # Demo Suspicious Mode: calibrated, realistic
    # IEEE-CIS patterns layered over normal traffic.
    # The model (never this code) decides the outcome.
    # --------------------------------------------------

    try:

        from demo_suspicious import maybe_apply_demo_pattern

        transaction, _ = maybe_apply_demo_pattern(
            transaction
        )

    except Exception:

        pass

    return transaction


def update_account_history(
    transaction
):

    account_id = transaction.get(
        "customer_account"
    )

    if account_id not in account_history:
        return

    try:
        amount = float(
            transaction.get("transaction_amount", 0.0)
        )
    except (TypeError, ValueError):
        return

    additional_data = (
        transaction.get("additional_data") or {}
    )

    device_information = (
        transaction.get("device_information") or {}
    )

    profile = account_history[
        account_id
    ]

    city = (
        additional_data.get("city")
        or profile.get("usual_city")
    )

    device_id = (
        device_information.get("device_id")
        or profile.get("usual_device")
    )

    old_count = profile[
        "transaction_count"
    ]

    old_average = profile[
        "average_amount"
    ]

    new_count = old_count + 1

    new_average = (
        (
            old_average * old_count
        )
        + amount
    ) / new_count

    profile[
        "transaction_count"
    ] = new_count

    profile[
        "total_amount"
    ] = round(
        profile["total_amount"]
        + amount,
        2,
    )

    profile[
        "average_amount"
    ] = round(
        new_average,
        2,
    )

    profile[
        "last_transaction_time"
    ] = transaction[
        "transaction_time"
    ]

    if (
        profile["transaction_count"]
        == 1
    ):

        profile[
            "usual_city"
        ] = city

        profile[
            "usual_device"
        ] = device_id

    save_account_history(
        account_history
    )


def send_transaction(transaction):

    try:

        if KAFKA_ENABLED:

            try:

                from kafka_producer import publish_transaction

                metadata = publish_transaction(transaction)

                print()
                print("=" * 60)
                print(
                    "QUEUED VIA KAFKA"
                )
                print("=" * 60)

                print(
                    "Transaction ID :",
                    transaction["txn_id"],
                )

                print(
                    "Account        :",
                    transaction[
                        "customer_account"
                    ],
                )

                print(
                    "Topic          :",
                    f"{KAFKA_TOPIC} "
                    f"(partition {metadata.partition}, "
                    f"offset {metadata.offset})",
                )

                print(
                    "Scenario       :",
                    (transaction.get("additional_data") or {}).get(
                        "scenario", "NORMAL"
                    ),
                )

                print(
                    "Scoring happens in the Phoenix "
                    "Kafka consumer; watch the "
                    "Transactions page."
                )

                update_account_history(
                    transaction
                )

                return

            except Exception as kafka_error:

                print()
                print(
                    "Kafka unavailable "
                    f"({kafka_error}); falling back "
                    "to direct HTTP scoring."
                )

        headers = {}
        admin_email = os.getenv("PHOENIX_ADMIN_EMAIL", "ayoradileep@gmail.com")
        admin_password = os.getenv("PHOENIX_ADMIN_PASSWORD", "admin123")
        try:
            auth_res = requests.post(
                f"{API_URL}/auth/login",
                json={"email": admin_email, "password": admin_password},
                timeout=10,
            )
            if auth_res.status_code == 200:
                token = auth_res.json().get("access_token")
                if token:
                    headers["Authorization"] = f"Bearer {token}"
        except Exception:
            pass

        response = requests.post(
            TRANSACTION_SCORE_ENDPOINT,
            json=transaction,
            headers=headers,
            timeout=30,
        )

        print()
        print("=" * 60)
        print(
            "INCOMING BANKING TRANSACTION"
        )
        print("=" * 60)

        print(
            "Transaction ID :",
            transaction["txn_id"],
        )

        print(
            "Account        :",
            transaction[
                "customer_account"
            ],
        )

        print(
            "Amount         : ₹",
            transaction[
                "transaction_amount"
            ],
        )

        print(
            "Scenario       :",
            transaction[
                "additional_data"
            ]["scenario"],
        )

        print(
            "Previous count :",
            transaction[
                "additional_data"
            ][
                "previous_transaction_count"
            ],
        )

        print(
            "Previous avg   : ₹",
            transaction[
                "additional_data"
            ][
                "previous_average_amount"
            ],
        )

        print(
            "Device         :",
            (transaction.get("device_information") or {}).get(
                "device_id", "—"
            ),
        )

        print(
            "Location       :",
            (transaction.get("additional_data") or {}).get(
                "city", "—"
            ),
        )

        if response.ok:

            result = response.json()

            print()
            print(
                "PHOENIX ANALYSIS"
            )
            print("-" * 60)

            print(
                "Fraud probability :",
                result.get(
                    "fraud_probability"
                ),
            )

            print(
                "Predicted label   :",
                result.get(
                    "predicted_label"
                ),
            )

            print(
                "Risk level        :",
                result.get(
                    "risk_level"
                ),
            )

            print(
                "Decision          :",
                result.get(
                    "decision"
                ),
            )

            update_account_history(
                transaction
            )

        else:

            print()
            print(
                "Phoenix returned:",
                response.status_code,
            )

            print(
                response.text
            )

    except requests.RequestException as error:

        print()
        print(
            "Could not connect to Phoenix API:"
        )

        print(error)


def main():

    print(
        "Phoenix Banking Transaction Simulator"
    )

    print("=" * 60)

    print(
        "Persistent account behavior enabled."
    )

    print(
        "Sending transactions every",
        TRANSACTION_INTERVAL_SECONDS,
        "seconds.",
    )

    print(
        "Press Ctrl+C to stop."
    )

    try:

        while True:

            transaction = (
                generate_transaction()
            )

            send_transaction(
                transaction
            )

            time.sleep(
                TRANSACTION_INTERVAL_SECONDS
            )

    except KeyboardInterrupt:

        print()
        print("Stopping simulator.")

    finally:

        if KAFKA_ENABLED:

            try:

                from kafka_producer import close_producer

                close_producer()

            except Exception:

                pass


if __name__ == "__main__":

    main()