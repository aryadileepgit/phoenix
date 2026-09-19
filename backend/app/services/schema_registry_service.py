from sqlalchemy import select

from app.database.database import SessionLocal
from app.models.schema_registry import SchemaRegistry


class SchemaRegistryService:

    def get_mapping(self, incoming_column: str):

        with SessionLocal() as db:
            mapping = db.execute(
                select(SchemaRegistry)
                .where(
                    SchemaRegistry.incoming_column == incoming_column
                )
                .order_by(
                    SchemaRegistry.created_at.desc()
                )
            ).scalars().first()

            if not mapping:
                return None

            if mapping.approval_status != "Approved":
                return None

            return {
                "incoming_column": mapping.incoming_column,
                "standard_column": mapping.standard_column,
                "mapping_method": mapping.mapping_method,
                "confidence": float(mapping.confidence),
                "approval_status": mapping.approval_status,
            }

    def save_mapping(
        self,
        incoming_column: str,
        standard_column: str,
        confidence: float,
        mapping_method: str = "Gemini",
        approval_status: str = "Approved",
    ):

        with SessionLocal() as db:

            existing = db.execute(
                select(SchemaRegistry)
                .where(
                    SchemaRegistry.incoming_column == incoming_column,
                    SchemaRegistry.standard_column == standard_column,
                )
            ).scalars().first()

            if existing:
                existing.confidence = confidence
                existing.mapping_method = mapping_method
                existing.approval_status = approval_status
            else:
                mapping = SchemaRegistry(
                    incoming_column=incoming_column,
                    standard_column=standard_column,
                    mapping_method=mapping_method,
                    confidence=confidence,
                    approval_status=approval_status,
                )

                db.add(mapping)

            db.commit()

    def get_all_mappings(self):

        with SessionLocal() as db:

            mappings = db.execute(
                select(SchemaRegistry)
                .order_by(
                    SchemaRegistry.created_at.desc()
                )
            ).scalars().all()

            return [
                {
                    "incoming_column": mapping.incoming_column,
                    "standard_column": mapping.standard_column,
                    "mapping_method": mapping.mapping_method,
                    "confidence": float(mapping.confidence),
                    "approval_status": mapping.approval_status,
                }
                for mapping in mappings
            ]


schema_registry_service = SchemaRegistryService()