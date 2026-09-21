import os
from typing import List

from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field


load_dotenv()


class FieldMapping(BaseModel):
    source_field: str = Field(
        description="The field name from the incoming transaction schema."
    )

    canonical_field: str = Field(
        description="The Phoenix canonical field represented by the source field."
    )

    confidence: float = Field(
        description="Confidence of the semantic mapping from 0.0 to 1.0."
    )

    reason: str = Field(
        description="Short explanation for the semantic mapping."
    )


class SchemaMappingResult(BaseModel):
    mappings: List[FieldMapping]


class GeminiSchemaMapper:

    CANONICAL_FIELDS = {
        "transaction_id": "Unique identifier of the transaction.",
        "account_id": "Identifier of the customer or account.",
        "amount": "Monetary amount of the transaction.",
        "transaction_time": "Date and time when the transaction occurred.",
        "product_code": "Code identifying the product or transaction category.",
        "card_information": "Information related to the payment card.",
        "device_information": "Information related to the device used for the transaction.",
        "additional_data": "Other transaction-related information.",
    }

    MIN_CONFIDENCE = 0.70

    def __init__(self):

        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured in the environment."
            )

        self.client = genai.Client(api_key=api_key)

        self.model_name = "gemini-3.6-flash"

    def map_fields(self, incoming_fields: List[str]) -> SchemaMappingResult:

        canonical_description = "\n".join(
            f"- {field}: {description}"
            for field, description in self.CANONICAL_FIELDS.items()
        )

        incoming_description = "\n".join(
            f"- {field}"
            for field in incoming_fields
        )

        prompt = f"""
You are the schema-mapping component of a fraud detection system
called Phoenix.

Your task is to map fields from an incoming transaction schema
to Phoenix's canonical transaction schema.

IMPORTANT RULES:

1. Only map a source field when its meaning matches a canonical field.
2. Do not invent canonical fields.
3. Do not map a field merely because its name looks similar.
4. Use semantic meaning.
5. If a field has no reasonable canonical equivalent, do not include it.
6. Confidence must be between 0.0 and 1.0.
7. Return only the structured mapping result.

Phoenix canonical fields:

{canonical_description}

Incoming fields:

{incoming_description}

Determine the semantic mapping.
"""

        interaction = self.client.interactions.create(
            model=self.model_name,
            input=prompt,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": SchemaMappingResult.model_json_schema(),
            },
        )

        if not interaction.output_text:
            raise RuntimeError(
                "Gemini returned an empty response."
            )

        return SchemaMappingResult.model_validate_json(
            interaction.output_text
        )


_mapper_instance = None


def get_gemini_mapper() -> GeminiSchemaMapper:
    """
    Lazy singleton. Importing this module must never crash the
    API when GEMINI_API_KEY is missing; the error surfaces only
    when AI mapping is actually requested, with a clear message
    and registry/heuristic fallback available to callers.
    """

    global _mapper_instance

    if _mapper_instance is None:
        _mapper_instance = GeminiSchemaMapper()

    return _mapper_instance