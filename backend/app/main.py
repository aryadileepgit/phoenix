from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.base import Base
from app.database.database import engine

import app.models

from app.api.auth import router as auth_router
from app.api.dataset import router as dataset_router  
from app.api import history

Base.metadata.create_all(bind=engine)

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
app.include_router(auth_router)
app.include_router(dataset_router)
app.include_router(history.router)
