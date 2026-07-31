from fastapi import FastAPI

app = FastAPI(
    title="Phoenix API",
    version="1.0.0",
    description="Adaptive Fraud Detection Platform"
)

@app.get("/")
def root():
    return {
        "message": "Welcome to Phoenix API"
    }

@app.get("/health")
def health():
    return {
        "status": "Running"
    }