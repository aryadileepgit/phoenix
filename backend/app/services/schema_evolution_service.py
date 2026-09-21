from typing import Any

from app.services.schema_registry_service import schema_registry_service


class SchemaEvolutionService:

    CANONICAL_FIELDS = {
        "transaction_id",
        "account_id",
        "amount",
        "transaction_time",
        "product_code",
        "card_information",
        "device_information",
        "additional_data",
    }

    # Kept for backwards compatibility; the live value comes
    # from runtime_settings.get_min_confidence().
    MIN_CONFIDENCE = 0.70

    def normalize_transaction(
        self,
        incoming_transaction: dict[str, Any],
    ) -> dict[str, Any]:

        incoming_fields = list(incoming_transaction.keys())

        resolved_mappings = {}
        unknown_fields = []

        for field in incoming_fields:

            registry_mapping = (
                schema_registry_service.get_mapping(field)
            )

            if registry_mapping:
                resolved_mappings[field] = registry_mapping
            else:
                unknown_fields.append(field)

        if unknown_fields:

            from app.services.gemini_schema_mapper import (
                get_gemini_mapper,
            )
            from app.services.runtime_settings import (
                get_min_confidence,
            )

            gemini_result = get_gemini_mapper().map_fields(
                unknown_fields
            )

            min_confidence = get_min_confidence()

            for mapping in gemini_result.mappings:

                if mapping.canonical_field not in self.CANONICAL_FIELDS:
                    continue

                if mapping.confidence < min_confidence:
                    continue

                schema_registry_service.save_mapping(
                    incoming_column=mapping.source_field,
                    standard_column=mapping.canonical_field,
                    confidence=mapping.confidence,
                    mapping_method="Gemini",
                    approval_status="Approved",
                )

                resolved_mappings[mapping.source_field] = {
                    "incoming_column": mapping.source_field,
                    "standard_column": mapping.canonical_field,
                    "mapping_method": "Gemini",
                    "confidence": mapping.confidence,
                    "approval_status": "Approved",
                }

        canonical_transaction = {}

        for incoming_field, value in incoming_transaction.items():

            mapping = resolved_mappings.get(incoming_field)

            if not mapping:
                continue

            canonical_field = mapping["standard_column"]

            if canonical_field in canonical_transaction:
                continue

            canonical_transaction[canonical_field] = value

        return {
            "canonical_transaction": canonical_transaction,
            "mappings_used": resolved_mappings,
            "unmapped_fields": [
                field
                for field in incoming_fields
                if field not in resolved_mappings
            ],
        }


schema_evolution_service = SchemaEvolutionService()