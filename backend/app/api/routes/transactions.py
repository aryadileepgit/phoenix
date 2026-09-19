from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.transaction import Transaction
from app.schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
)
from app.services.model_scoring_service import (
    fraud_scoring_service,
)
from app.services.schema_evolution_service import (
    schema_evolution_service,
)
from app.services.shap_explanation_service import (
    shap_explanation_service,
)

router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/score",
    response_model=TransactionResponse,
)
async def create_transaction(
    incoming_transaction: dict = Body(...),
    db: Session = Depends(get_db),
):
    try:
        evolution_result = (
            schema_evolution_service.normalize_transaction(
                incoming_transaction
            )
        )

        canonical_transaction = (
            evolution_result["canonical_transaction"]
        )

        if evolution_result["unmapped_fields"]:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Transaction contains unmapped fields.",
                    "unmapped_fields": evolution_result[
                        "unmapped_fields"
                    ],
                },
            )

        transaction = TransactionCreate.model_validate(
            canonical_transaction
        )

        transaction_data = transaction.model_dump()

        scoring_result = fraud_scoring_service.score(
            transaction_data
        )

        new_transaction = Transaction(
            transaction_id=transaction.transaction_id,
            account_id=transaction.account_id,
            amount=transaction.amount,
            transaction_time=transaction.transaction_time,
            product_code=transaction.product_code,
            card_information=transaction.card_information,
            device_information=transaction.device_information,
            additional_data=transaction.additional_data,
            fraud_probability=scoring_result[
                "fraud_probability"
            ],
            predicted_label=scoring_result[
                "predicted_label"
            ],
            risk_level=scoring_result[
                "risk_level"
            ],
            decision=scoring_result[
                "decision"
            ],
        )

        db.add(new_transaction)
        db.commit()
        db.refresh(new_transaction)

        return new_transaction

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Transaction scoring failed: {str(e)}",
        )


@router.post("/explain")
def explain_transaction(
    transaction: TransactionCreate,
):
    try:
        transaction_data = transaction.model_dump()

        scoring_result = fraud_scoring_service.score(
            transaction_data
        )

        feature_df = fraud_scoring_service._build_features(
            transaction_data
        )

        processed_df = fraud_scoring_service._preprocess(
            feature_df
        )

        explanations = shap_explanation_service.explain(
            processed_df
        )

        return {
            "transaction_id": transaction.transaction_id,
            "fraud_probability": scoring_result[
                "fraud_probability"
            ],
            "predicted_label": scoring_result[
                "predicted_label"
            ],
            "risk_level": scoring_result[
                "risk_level"
            ],
            "decision": scoring_result[
                "decision"
            ],
            "top_explanations": explanations,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SHAP explanation failed: {str(e)}",
        )


@router.get("/account/{account_id}/history")
def get_account_transaction_history(
    account_id: str,
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.account_id == account_id)
        .order_by(Transaction.transaction_time.desc())
        .all()
    )

    return {
        "account_id": account_id,
        "total_transactions": len(transactions),
        "transactions": [
            {
                "transaction_id": transaction.transaction_id,
                "amount": float(transaction.amount),
                "transaction_time": transaction.transaction_time,
                "fraud_probability": (
                    float(transaction.fraud_probability)
                    if transaction.fraud_probability is not None
                    else None
                ),
                "predicted_label": transaction.predicted_label,
                "risk_level": transaction.risk_level,
                "decision": transaction.decision,
                "actual_label": transaction.actual_label,
            }
            for transaction in transactions
        ],
    }


@router.get("/account/{account_id}/risk")
def get_account_risk(
    account_id: str,
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.account_id == account_id)
        .order_by(Transaction.transaction_time.desc())
        .all()
    )

    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for account {account_id}",
        )

    probabilities = [
        float(transaction.fraud_probability)
        for transaction in transactions
        if transaction.fraud_probability is not None
    ]

    suspicious_transactions = [
        transaction
        for transaction in transactions
        if transaction.fraud_probability is not None
        and float(transaction.fraud_probability) >= 0.30
    ]

    high_risk_transactions = [
        transaction
        for transaction in transactions
        if transaction.risk_level == "HIGH"
    ]

    recent_transactions = transactions[:5]

    recent_suspicious_transactions = [
        transaction
        for transaction in recent_transactions
        if transaction.fraud_probability is not None
        and float(transaction.fraud_probability) >= 0.30
    ]

    average_fraud_probability = (
        sum(probabilities) / len(probabilities)
        if probabilities
        else 0.0
    )

    latest_transaction = transactions[0]

    suspicious_rate = (
        len(suspicious_transactions)
        / len(transactions)
    )

    risk_score = average_fraud_probability * 100

    risk_factors = []

    if len(high_risk_transactions) >= 2:
        risk_factors.append(
            "Multiple high-risk transactions"
        )
        risk_score += 20

    elif len(high_risk_transactions) == 1:
        risk_factors.append(
            "High-risk transaction detected"
        )
        risk_score += 10

    if suspicious_rate >= 0.50:
        risk_factors.append(
            "High suspicious transaction frequency"
        )
        risk_score += 20

    elif suspicious_rate >= 0.20:
        risk_factors.append(
            "Repeated suspicious transaction activity"
        )
        risk_score += 10

    if len(recent_suspicious_transactions) >= 2:
        risk_factors.append(
            "Recent suspicious activity"
        )
        risk_score += 15

    if average_fraud_probability >= 0.70:
        risk_factors.append(
            "High average fraud probability"
        )
        risk_score += 15

    risk_score = min(
        round(risk_score, 2),
        100.0,
    )

    if risk_score >= 70:
        account_risk = "HIGH"
    elif risk_score >= 30:
        account_risk = "MEDIUM"
    else:
        account_risk = "LOW"

    investigation_required = account_risk == "HIGH"

    return {
        "account_id": account_id,
        "account_risk": account_risk,
        "risk_score": risk_score,
        "investigation_required": investigation_required,
        "total_transactions": len(transactions),
        "suspicious_transactions": len(
            suspicious_transactions
        ),
        "high_risk_transactions": len(
            high_risk_transactions
        ),
        "recent_suspicious_transactions": len(
            recent_suspicious_transactions
        ),
        "suspicious_rate": round(
            suspicious_rate,
            4,
        ),
        "average_fraud_probability": round(
            average_fraud_probability,
            4,
        ),
        "latest_fraud_probability": (
            float(latest_transaction.fraud_probability)
            if latest_transaction.fraud_probability is not None
            else None
        ),
        "latest_risk_level": (
            latest_transaction.risk_level
        ),
        "latest_decision": (
            latest_transaction.decision
        ),
        "risk_factors": risk_factors,
    }


@router.get("/account/{account_id}/investigation")
def investigate_account(
    account_id: str,
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.account_id == account_id)
        .order_by(Transaction.transaction_time.desc())
        .all()
    )

    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for account {account_id}",
        )

    suspicious_transactions = [
        transaction
        for transaction in transactions
        if transaction.fraud_probability is not None
        and float(transaction.fraud_probability) >= 0.30
    ]

    high_risk_transactions = [
        transaction
        for transaction in transactions
        if transaction.risk_level == "HIGH"
    ]

    total_suspicious_amount = sum(
        float(transaction.amount)
        for transaction in suspicious_transactions
    )

    highest_risk_transaction = None

    if suspicious_transactions:
        highest_risk_transaction = max(
            suspicious_transactions,
            key=lambda transaction: (
                float(transaction.fraud_probability)
                if transaction.fraud_probability is not None
                else 0
            ),
        )

    if high_risk_transactions:
        investigation_status = "HIGH_PRIORITY"
    elif suspicious_transactions:
        investigation_status = "REVIEW"
    else:
        investigation_status = "NO_SUSPICIOUS_ACTIVITY"

    return {
        "account_id": account_id,
        "investigation_status": investigation_status,
        "total_transactions": len(transactions),
        "suspicious_transaction_count": len(
            suspicious_transactions
        ),
        "high_risk_transaction_count": len(
            high_risk_transactions
        ),
        "total_suspicious_amount": round(
            total_suspicious_amount,
            2,
        ),
        "highest_risk_transaction": (
            {
                "transaction_id": (
                    highest_risk_transaction.transaction_id
                ),
                "amount": float(
                    highest_risk_transaction.amount
                ),
                "transaction_time": (
                    highest_risk_transaction.transaction_time
                ),
                "fraud_probability": float(
                    highest_risk_transaction.fraud_probability
                ),
                "risk_level": (
                    highest_risk_transaction.risk_level
                ),
                "decision": (
                    highest_risk_transaction.decision
                ),
            }
            if highest_risk_transaction
            else None
        ),
        "suspicious_transactions": [
            {
                "transaction_id": transaction.transaction_id,
                "amount": float(transaction.amount),
                "transaction_time": transaction.transaction_time,
                "fraud_probability": (
                    float(transaction.fraud_probability)
                    if transaction.fraud_probability is not None
                    else None
                ),
                "risk_level": transaction.risk_level,
                "decision": transaction.decision,
                "predicted_label": transaction.predicted_label,
                "actual_label": transaction.actual_label,
            }
            for transaction in suspicious_transactions
        ],
    }


def extract_relationship_attributes(transaction):
    attributes = {}

    if isinstance(transaction.card_information, dict):
        for key, value in transaction.card_information.items():
            if value is not None and str(value).strip():
                attributes[f"card:{key}"] = str(value).strip()

    if isinstance(transaction.device_information, dict):
        for key, value in transaction.device_information.items():
            if value is not None and str(value).strip():
                attributes[f"device:{key}"] = str(value).strip()

    if isinstance(transaction.additional_data, dict):
        relationship_fields = [
            "card1",
            "card2",
            "card3",
            "card4",
            "card5",
            "card6",
            "P_emaildomain",
            "R_emaildomain",
            "addr1",
            "addr2",
            "DeviceType",
            "DeviceInfo",
        ]

        for field in relationship_fields:
            value = transaction.additional_data.get(field)

            if value is not None and str(value).strip():
                attributes[f"data:{field}"] = str(value).strip()

    return attributes


@router.get("/network/{account_id}")
def get_account_network(
    account_id: str,
    db: Session = Depends(get_db),
):
    account_transactions = (
        db.query(Transaction)
        .filter(Transaction.account_id == account_id)
        .all()
    )

    if not account_transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for account {account_id}",
        )

    all_transactions = (
        db.query(Transaction)
        .filter(Transaction.account_id != account_id)
        .all()
    )

    target_attributes = {}

    for transaction in account_transactions:
        attributes = extract_relationship_attributes(
            transaction
        )

        for attribute, value in attributes.items():
            target_attributes.setdefault(
                attribute,
                set(),
            ).add(value)

    related_accounts = {}

    for transaction in all_transactions:
        attributes = extract_relationship_attributes(
            transaction
        )

        shared_attributes = []

        for attribute, value in attributes.items():
            if (
                attribute in target_attributes
                and value in target_attributes[attribute]
            ):
                shared_attributes.append(
                    {
                        "type": attribute.split(":", 1)[0],
                        "field": attribute.split(":", 1)[1],
                        "value": value,
                    }
                )

        if not shared_attributes:
            continue

        related_account_id = transaction.account_id

        if related_account_id not in related_accounts:
            related_accounts[related_account_id] = {
                "account_id": related_account_id,
                "shared_attributes": [],
                "transactions": [],
                "suspicious_transactions": 0,
                "highest_fraud_probability": 0.0,
            }

        existing_attributes = related_accounts[
            related_account_id
        ]["shared_attributes"]

        for shared_attribute in shared_attributes:
            if shared_attribute not in existing_attributes:
                existing_attributes.append(
                    shared_attribute
                )

        related_accounts[
            related_account_id
        ]["transactions"].append(
            {
                "transaction_id": transaction.transaction_id,
                "amount": float(transaction.amount),
                "transaction_time": transaction.transaction_time,
                "fraud_probability": (
                    float(transaction.fraud_probability)
                    if transaction.fraud_probability is not None
                    else None
                ),
                "risk_level": transaction.risk_level,
                "decision": transaction.decision,
            }
        )

        if (
            transaction.fraud_probability is not None
            and float(transaction.fraud_probability) >= 0.30
        ):
            related_accounts[
                related_account_id
            ]["suspicious_transactions"] += 1

        if transaction.fraud_probability is not None:
            related_accounts[
                related_account_id
            ]["highest_fraud_probability"] = max(
                related_accounts[
                    related_account_id
                ]["highest_fraud_probability"],
                float(transaction.fraud_probability),
            )

    for account in related_accounts.values():
        highest_probability = account[
            "highest_fraud_probability"
        ]

        if highest_probability >= 0.70:
            network_risk = "HIGH"
        elif highest_probability >= 0.30:
            network_risk = "MEDIUM"
        else:
            network_risk = "LOW"

        account["network_risk"] = network_risk
        account["transaction_count"] = len(
            account["transactions"]
        )

    related_accounts_list = sorted(
        related_accounts.values(),
        key=lambda account: (
            account["highest_fraud_probability"],
            account["suspicious_transactions"],
        ),
        reverse=True,
    )

    return {
        "account_id": account_id,
        "network_status": (
            "CONNECTED"
            if related_accounts_list
            else "NO_CONNECTED_ACCOUNTS"
        ),
        "connected_account_count": len(
            related_accounts_list
        ),
        "connected_accounts": related_accounts_list,
    }