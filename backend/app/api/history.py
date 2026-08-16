from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.services.history_service import get_pipeline_history

router = APIRouter(prefix="/dataset", tags=["Pipeline History"])


@router.get("/history")
def history(db: Session = Depends(get_db)):
    return get_pipeline_history(db)