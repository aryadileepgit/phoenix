def run_startup_migrations(engine):
    # Legacy PaySim transaction migrations are no longer required.
    # The current transaction schema is managed by SQLAlchemy models.
    return