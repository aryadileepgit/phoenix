from sqlalchemy import text
from sqlalchemy.engine import Engine


# --------------------------------------------------
# Startup migrations
# --------------------------------------------------
#
# This project has no Alembic (or other migration tool). SQLAlchemy's
# Base.metadata.create_all() only creates *missing tables* — it does
# not add new columns to tables that already exist. This module fills
# that specific gap for the columns introduced by this change.
#
# Rules this function follows:
#   - Only ever ADDs columns, and only if they don't already exist.
#   - Only ever relaxes a NOT NULL constraint, never adds one.
#   - Never drops a column, a table, or any row of data.
#   - Every statement is safe to run repeatedly (idempotent).
#
# Equivalent raw SQL, if you'd rather run it by hand instead of at
# startup:
#
#   ALTER TABLE model_reports ADD COLUMN IF NOT EXISTS confusion_matrix JSONB;
#   ALTER TABLE model_reports ADD COLUMN IF NOT EXISTS roc_curve JSONB;
#   ALTER TABLE model_reports ADD COLUMN IF NOT EXISTS feature_importance JSONB;
#   ALTER TABLE transactions ADD COLUMN IF NOT EXISTS predicted_label BOOLEAN;
#   ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fraud_probability DOUBLE PRECISION;
#   ALTER TABLE transactions ALTER COLUMN sender DROP NOT NULL;
#   ALTER TABLE transactions ALTER COLUMN receiver DROP NOT NULL;
#   ALTER TABLE transactions ALTER COLUMN actual_label DROP NOT NULL;

_STARTUP_MIGRATIONS = [
    "ALTER TABLE model_reports ADD COLUMN IF NOT EXISTS confusion_matrix JSONB",
    "ALTER TABLE model_reports ADD COLUMN IF NOT EXISTS roc_curve JSONB",
    "ALTER TABLE model_reports ADD COLUMN IF NOT EXISTS feature_importance JSONB",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS predicted_label BOOLEAN",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fraud_probability DOUBLE PRECISION",
    "ALTER TABLE transactions ALTER COLUMN sender DROP NOT NULL",
    "ALTER TABLE transactions ALTER COLUMN receiver DROP NOT NULL",
    "ALTER TABLE transactions ALTER COLUMN actual_label DROP NOT NULL",
]


def run_startup_migrations(engine: Engine) -> None:
    with engine.begin() as connection:
        for statement in _STARTUP_MIGRATIONS:
            try:
                connection.execute(text(statement))
            except Exception as exc:  # defensive — never block startup on a migration
                print(f"[startup-migration] Skipped '{statement}': {exc}")
