from datetime import datetime
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    transaction_id: str = Field(..., min_length=1, max_length=100)
    account_id: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    transaction_time: datetime
    product_code: str | None = Field(default=None, max_length=10)

    card_information: dict | None = None
    device_information: dict | None = None
    additional_data: dict | None = None


class TransactionResponse(BaseModel):
    transaction_id: str
    account_id: str
    amount: float
    transaction_time: datetime
    fraud_probability: float | None
    predicted_label: bool | None
    risk_level: str | None
    decision: str | None