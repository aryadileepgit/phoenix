from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.transaction import Transaction

router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"]
)


def _serialize(transaction: Transaction) -> dict:
    return {
        "id": str(transaction.id),
        "dataset_id": str(transaction.dataset_id),
        "step": transaction.step,
        "type": transaction.transaction_type,
        "amount": float(transaction.amount),
        "sender": transaction.sender,
        "sender_balance_before": (
            float(transaction.sender_balance_before)
            if transaction.sender_balance_before is not None else None
        ),
        "sender_balance_after": (
            float(transaction.sender_balance_after)
            if transaction.sender_balance_after is not None else None
        ),
        "receiver": transaction.receiver,
        "receiver_balance_before": (
            float(transaction.receiver_balance_before)
            if transaction.receiver_balance_before is not None else None
        ),
        "receiver_balance_after": (
            float(transaction.receiver_balance_after)
            if transaction.receiver_balance_after is not None else None
        ),
        "actual_label": transaction.actual_label,
        "predicted_label": transaction.predicted_label,
        "fraud_probability": (
            float(transaction.fraud_probability)
            if transaction.fraud_probability is not None else None
        ),
        "created_at": transaction.created_at,
    }


# ==================================================
# LIST TRANSACTIONS
# ==================================================
#
# Summary counts (total/fraud/legitimate/fraud_rate) are always
# computed across ALL transactions, independent of the filters below,
# so the summary cards on the Transactions page reflect overall
# platform activity while the table respects whatever the user is
# currently filtering for.

@router.get("")
def list_transactions(
    dataset_id: Optional[UUID] = None,
    prediction: Optional[str] = Query(
        None, description="Filter by 'fraud' or 'legitimate'."
    ),
    transaction_type: Optional[str] = None,
    search: Optional[str] = Query(
        None, description="Matches transaction type, sender, or receiver."
    ),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):

    try:

        base_query = db.query(Transaction)

        total_transactions = base_query.count()

        fraud_count = base_query.filter(
            Transaction.predicted_label.is_(True)
        ).count()

        legitimate_count = base_query.filter(
            Transaction.predicted_label.is_(False)
        ).count()

        fraud_rate = (
            round((fraud_count / total_transactions) * 100, 2)
            if total_transactions else 0.0
        )

        query = base_query

        if dataset_id is not None:
            query = query.filter(Transaction.dataset_id == dataset_id)

        if prediction == "fraud":
            query = query.filter(Transaction.predicted_label.is_(True))
        elif prediction == "legitimate":
            query = query.filter(Transaction.predicted_label.is_(False))

        if transaction_type:
            query = query.filter(
                Transaction.transaction_type == transaction_type
            )

        if search:
            like_value = f"%{search}%"
            query = query.filter(
                (Transaction.transaction_type.ilike(like_value))
                | (Transaction.sender.ilike(like_value))
                | (Transaction.receiver.ilike(like_value))
            )

        transactions = (
            query
            .order_by(desc(Transaction.created_at))
            .limit(limit)
            .all()
        )

        return {

            "message":
                "Transactions retrieved successfully.",

            "summary": {
                "total_transactions": total_transactions,
                "fraud_count": fraud_count,
                "legitimate_count": legitimate_count,
                "fraud_rate": fraud_rate,
            },

            "transactions": [
                _serialize(transaction)
                for transaction in transactions
            ],
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# GET TRANSACTION BY ID
# ==================================================

@router.get("/{transaction_id}")
def get_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
):

    try:

        transaction = (
            db.query(Transaction)
            .filter(Transaction.id == transaction_id)
            .first()
        )

        if transaction is None:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found."
            )

        return {

            "message":
                "Transaction retrieved successfully.",

            "transaction":
                _serialize(transaction),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
