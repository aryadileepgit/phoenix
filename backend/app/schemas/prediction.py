from typing import Dict, Any

from pydantic import BaseModel


class PredictionRequest(BaseModel):

    transaction: Dict[str, Any]