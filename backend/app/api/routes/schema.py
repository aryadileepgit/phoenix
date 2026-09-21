from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.schema_registry import SchemaRegistry
from app.services.runtime_settings import get_min_confidence
from app.services.schema_registry_service import (
    schema_registry_service,
)


router = APIRouter(
    prefix="/schema",
    tags=["Schema Evolution"],
)


CANONICAL_FIELDS = {
    "transaction_id": "Unique identifier of the transaction.",
    "account_id": "Identifier of the customer or account.",
    "amount": "Monetary amount of the transaction.",
    "transaction_time": "Date and time when the transaction occurred.",
    "product_code": "Code identifying the product or transaction category.",
    "card_information": "Information related to the payment card.",
    "device_information": (
        "Information related to the device used for the transaction."
    ),
    "additional_data": "Other transaction-related information.",
}


def _serialize_mapping(mapping):
    method = (mapping.mapping_method or "").lower()

    if method == "gemini":
        ui_method = "gemini"
    elif method == "manual":
        ui_method = "manual"
    elif method == "heuristic":
        ui_method = "heuristic"
    else:
        ui_method = "auto"

    return {
        "id": str(mapping.id),
        "incomingField": mapping.incoming_column,
        "canonicalField": mapping.standard_column,
        "method": ui_method,
        "confidence": float(mapping.confidence),
        "approved": mapping.approval_status == "Approved",
        "approvalStatus": mapping.approval_status,
        "createdAt": mapping.created_at,
    }


class GeminiMapRequest(BaseModel):
    fields: list[str]


@router.get("/registry")
def get_registry(db: Session = Depends(get_db)):
    import os

    mappings = (
        db.query(SchemaRegistry)
        .order_by(SchemaRegistry.created_at.desc())
        .all()
    )

    serialized = [_serialize_mapping(m) for m in mappings]

    gemini_count = sum(
        1 for m in serialized if m["method"] == "gemini"
    )
    pending_count = sum(
        1 for m in serialized if not m["approved"]
    )

    latest = mappings[0].created_at if mappings else None

    return {
        "engineStatus": "online",
        "geminiConfigured": bool(os.getenv("GEMINI_API_KEY")),
        "minConfidence": get_min_confidence(),
        "mappings": serialized,
        "canonicalFields": [
            {"name": name, "description": description}
            for name, description in CANONICAL_FIELDS.items()
        ],
        "version": {
            "version": "1",
            "status": "active",
            "fields": len(CANONICAL_FIELDS),
            "timestamp": latest,
        },
        "stats": {
            "total": len(serialized),
            "gemini": gemini_count,
            "registry": len(serialized) - gemini_count,
            "pending": pending_count,
        },
    }


@router.post("/mappings/{mapping_id}/approve")
def approve_mapping(mapping_id: UUID, db: Session = Depends(get_db)):
    mapping = (
        db.query(SchemaRegistry)
        .filter(SchemaRegistry.id == mapping_id)
        .first()
    )

    if mapping is None:
        raise HTTPException(
            status_code=404, detail="Schema mapping not found."
        )

    mapping.approval_status = "Approved"
    db.commit()
    db.refresh(mapping)

    return {
        "message": "Mapping approved.",
        "mapping": _serialize_mapping(mapping),
    }


@router.post("/mappings/{mapping_id}/reject")
def reject_mapping(mapping_id: UUID, db: Session = Depends(get_db)):
    mapping = (
        db.query(SchemaRegistry)
        .filter(SchemaRegistry.id == mapping_id)
        .first()
    )

    if mapping is None:
        raise HTTPException(
            status_code=404, detail="Schema mapping not found."
        )

    mapping.approval_status = "Rejected"
    db.commit()
    db.refresh(mapping)

    return {
        "message": "Mapping rejected.",
        "mapping": _serialize_mapping(mapping),
    }


@router.post("/map-with-gemini")
def map_with_gemini(payload: GeminiMapRequest):
    from app.services.gemini_schema_mapper import get_gemini_mapper

    fields = [f for f in payload.fields if f and f.strip()]

    if not fields:
        raise HTTPException(
            status_code=422,
            detail="No fields provided for mapping.",
        )

    try:
        mapper = get_gemini_mapper()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    try:
        result = mapper.map_fields(fields)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini mapping failed: {str(e)}",
        )

    min_confidence = get_min_confidence()
    saved = 0
    skipped = 0

    for mapping in result.mappings:
        if (
            mapping.canonical_field not in CANONICAL_FIELDS
            or mapping.confidence < min_confidence
        ):
            skipped += 1
            continue

        schema_registry_service.save_mapping(
            incoming_column=mapping.source_field,
            standard_column=mapping.canonical_field,
            confidence=mapping.confidence,
            mapping_method="Gemini",
            approval_status="Approved",
        )
        saved += 1

    return {
        "message": (
            f"Gemini mapped {saved} field(s), "
            f"skipped {skipped} below confidence {min_confidence}."
        ),
        "saved": saved,
        "skipped": skipped,
    }
