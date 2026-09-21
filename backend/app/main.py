from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.base import Base
from app.database.database import engine
from app.database.migrations import run_startup_migrations

import app.models

from app.api.auth import router as auth_router
from app.api.dataset import router as dataset_router
from app.api.routes.transactions import router as transactions_router

Base.metadata.create_all(bind=engine)
run_startup_migrations(engine)

app = FastAPI(
    title="Phoenix API",
    version="1.0.0",
    description="Adaptive Fraud Transaction Detection Platform"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
# NOTE: app.api.history also defines GET /dataset/history but uses
# wrong column names (upload_time/filename/rows) and is shadowed by
# app.api.dataset's working handler. It is intentionally not mounted.
app.include_router(auth_router)
app.include_router(dataset_router)
app.include_router(transactions_router)

from app.api.routes.activity import router as activity_router
from app.api.routes.schema import router as schema_router
from app.api.routes.drift import router as drift_router
from app.api.routes.adaptive import router as adaptive_router
from app.api.routes.model import router as model_router
from app.api.routes.settings import router as settings_router
from app.api.routes.dashboard import router as dashboard_router

app.include_router(activity_router)
app.include_router(schema_router)
app.include_router(drift_router)
app.include_router(adaptive_router)
app.include_router(model_router)
app.include_router(settings_router)
app.include_router(dashboard_router)
