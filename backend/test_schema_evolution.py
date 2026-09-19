from app.services.schema_evolution_service import schema_evolution_service


incoming_transaction = {
    "txn_id": "PHX_SCHEMA_001",
    "customer_account": "ACC_SCHEMA_001",
    "transaction_amount": 750,
    "product": "W",
    "transaction_time": "2026-09-17T10:30:00+05:30",
}


result = schema_evolution_service.normalize_transaction(
    incoming_transaction
)


print("\nCANONICAL TRANSACTION")
print(result["canonical_transaction"])

print("\nMAPPINGS USED")
for field, mapping in result["mappings_used"].items():
    print(
        field,
        "->",
        mapping["standard_column"],
        "|",
        mapping["mapping_method"],
        "| confidence:",
        mapping["confidence"],
    )

print("\nUNMAPPED FIELDS")
print(result["unmapped_fields"])