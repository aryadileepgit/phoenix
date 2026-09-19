from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Integer, cast, desc, func
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.dataset import Dataset
from app.models.model_report import ModelReport
from app.models.transaction import Transaction

router = APIRouter(
    prefix="/activity",
    tags=["Activity"]
)


# ==================================================
# RECENT ACTIVITY
# ==================================================
#
# There is no dedicated "activity log" being written anywhere in this
# codebase (the `activity_logs` table exists but nothing ever inserts
# into it). Rather than fabricate events, this derives a real,
# timestamp-accurate feed directly from records that already exist:
# dataset uploads, completed model training runs, and batches of
# analyzed transactions.

@router.get("")
def get_recent_activity(
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
):

    try:
        events = []

        # --------------------------------------------------
        # Dataset uploads
        # --------------------------------------------------

        recent_datasets = (
            db.query(Dataset)
            .order_by(desc(Dataset.upload_date))
            .limit(limit)
            .all()
        )

        for dataset in recent_datasets:
            events.append({
                "type": "dataset_upload",
                "title": f'New dataset uploaded — "{dataset.dataset_name}"',
                "detail": (
                    f"{dataset.total_records:,} records"
                    if dataset.total_records else None
                ),
                "timestamp": dataset.upload_date,
            })

        # --------------------------------------------------
        # Completed model training runs
        # --------------------------------------------------

        recent_models = (
            db.query(ModelReport)
            .order_by(desc(ModelReport.created_at))
            .limit(limit)
            .all()
        )

        for model_report in recent_models:
            dataset = (
                db.query(Dataset)
                .filter(Dataset.id == model_report.dataset_id)
                .first()
            )

            events.append({
                "type": "model_trained",
                "title": f"Model trained successfully — {model_report.model_name}",
                "detail": (
                    f"{dataset.dataset_name if dataset else 'Unknown dataset'} · "
                    f"Accuracy {round(model_report.accuracy * 100, 2)}%"
                ),
                "timestamp": model_report.created_at,
            })

        # --------------------------------------------------
        # Batches of analyzed transactions
        # --------------------------------------------------
        #
        # Transactions uploaded together via one CSV all share the
        # same dataset_id and near-identical created_at, so grouping
        # by dataset + minute reconstructs "one analysis run".

        minute_bucket = func.date_trunc("minute", Transaction.created_at)

        batch_rows = (
            db.query(
                Transaction.dataset_id.label("dataset_id"),
                minute_bucket.label("bucket"),
                func.count(Transaction.id).label("total"),
                func.sum(cast(Transaction.predicted_label, Integer)).label("fraud_total"),
                func.max(Transaction.created_at).label("latest"),
            )
            .group_by(Transaction.dataset_id, minute_bucket)
            .order_by(desc("latest"))
            .limit(limit)
            .all()
        )

        for row in batch_rows:
            dataset = (
                db.query(Dataset)
                .filter(Dataset.id == row.dataset_id)
                .first()
            )

            fraud_total = int(row.fraud_total or 0)

            events.append({
                "type": "batch_analyzed",
                "title": f"Fraud analysis completed — {row.total} transaction(s)",
                "detail": (
                    f"{dataset.dataset_name if dataset else 'Unknown dataset'} · "
                    f"{fraud_total} flagged as fraud"
                ),
                "timestamp": row.latest,
            })

        events.sort(key=lambda e: e["timestamp"], reverse=True)

        return {

            "message":
                "Recent activity retrieved successfully.",

            "activity":
                events[:limit],
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
