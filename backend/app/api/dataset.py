from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session
from uuid import UUID

import traceback
import io
import pandas as pd

from pathlib import Path
from datetime import datetime

from fastapi.responses import FileResponse


# --------------------------------------------------
# Database
# --------------------------------------------------

from app.database.dependencies import get_db


# --------------------------------------------------
# Services
# --------------------------------------------------

from app.models.dataset import Dataset as DatasetModel

from app.services.dataset_service import save_dataset

from app.services.dataset_status_service import (
    get_latest_dataset,
    get_dataset_history
)

from app.services.pipeline_service import (
    run_dataset_pipeline
)

from app.services.cleaning_service import (
    clean_dataset
)

from app.services.preprocessing_service import (
    preprocess_dataset
)

from app.services.smote_service import (
    apply_smote
)

from app.services.feature_engineering_service import (
    feature_engineering
)

from app.services.training_service import (
    prepare_training_dataset
)

from app.services.model_training_service import (
    train_xgboost_model
)

from app.services.prediction_service import (
    predict_transaction,
    predict_transactions_batch
)


# --------------------------------------------------
# Schemas
# --------------------------------------------------

from app.schemas.prediction import (
    PredictionRequest
)


# ==================================================
# ROUTER
# ==================================================

router = APIRouter(
    prefix="/dataset",
    tags=["Dataset"]
)


# ==================================================
# STORAGE
# ==================================================

STORAGE_PATH = Path("storage")

RAW_PATH = STORAGE_PATH / "raw"
PROCESSED_PATH = STORAGE_PATH / "processed"
ENGINEERED_PATH = STORAGE_PATH / "engineered"
PREPROCESSED_PATH = STORAGE_PATH / "preprocessed"
BALANCED_PATH = STORAGE_PATH / "balanced"
TRAINING_PATH = STORAGE_PATH / "training"
MODEL_PATH = STORAGE_PATH / "models"
GRAPH_PATH = STORAGE_PATH / "graphs"

PREPROCESSING_MODEL_PATH = (
    STORAGE_PATH / "preprocessing_models"
)


# ==================================================
# IEEE-CIS CONSTANTS
# ==================================================

IEEE_CIS_DATASET_NAME = "ieee_cis"

IEEE_CIS_DATASET_ID = UUID(
    "f99a1cac-51a4-4d18-9b82-a06d975dd97b"
)


# --------------------------------------------------
# RAW DATA
# --------------------------------------------------

IEEE_CIS_TRANSACTION_FILE = (
    RAW_PATH
    / "ieee_cis"
    / "train_transaction.csv"
)

IEEE_CIS_IDENTITY_FILE = (
    RAW_PATH
    / "ieee_cis"
    / "train_identity.csv"
)


# --------------------------------------------------
# CLEANING
# --------------------------------------------------

IEEE_CIS_CLEAN_FILE = (
    PROCESSED_PATH
    / "ieee_cis_clean.csv"
)


# --------------------------------------------------
# FEATURE ENGINEERING
# --------------------------------------------------

IEEE_CIS_ENGINEERED_FILE = (
    ENGINEERED_PATH
    / "ieee_cis_engineered.csv"
)


# --------------------------------------------------
# PREPROCESSING
# --------------------------------------------------

IEEE_CIS_PREPROCESSED_TRAIN_FILE = (
    PREPROCESSED_PATH
    / "ieee_cis_train_preprocessed.csv"
)

IEEE_CIS_PREPROCESSED_TEST_FILE = (
    PREPROCESSED_PATH
    / "ieee_cis_test_preprocessed.csv"
)


IEEE_CIS_PREPROCESSOR_FILE = (
    PREPROCESSING_MODEL_PATH
    / "ieee_cis_preprocessor.joblib"
)

IEEE_CIS_FEATURE_METADATA_FILE = (
    PREPROCESSING_MODEL_PATH
    / "ieee_cis_feature_metadata.joblib"
)


# --------------------------------------------------
# SMOTE
# --------------------------------------------------

IEEE_CIS_BALANCED_TRAIN_FILE = (
    BALANCED_PATH
    / "ieee_cis_train_balanced.csv"
)

IEEE_CIS_BALANCED_TEST_FILE = (
    BALANCED_PATH
    / "ieee_cis_test.csv"
)


# --------------------------------------------------
# MODEL
# --------------------------------------------------

IEEE_CIS_MODEL_FILE = (
    MODEL_PATH
    / str(IEEE_CIS_DATASET_ID)
    / "phoenix_xgboost_model.joblib"
)

IEEE_CIS_MODEL_METADATA_FILE = (
    MODEL_PATH
    / str(IEEE_CIS_DATASET_ID)
    / "model_metadata.json"
)

IEEE_CIS_MODEL_FEATURES_FILE = (
    MODEL_PATH
    / str(IEEE_CIS_DATASET_ID)
    / "model_features.json"
)

IEEE_CIS_FEATURE_MEDIANS_FILE = (
    MODEL_PATH
    / str(IEEE_CIS_DATASET_ID)
    / "feature_medians.json"
)


# ==================================================
# HELPER: GET LATEST DATASET
# ==================================================

def _get_latest_dataset_record(db: Session):

    result = get_latest_dataset(db)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="No dataset found."
        )

    return result


# ==================================================
# HELPER: GET DATASET ID
# ==================================================

def _get_dataset_id(dataset):

    if isinstance(dataset, dict):

        return dataset.get("id")

    return getattr(
        dataset,
        "id",
        None
    )


# ==================================================
# HELPER: GET DATASET NAME
# ==================================================

def _get_dataset_name(dataset):

    if isinstance(dataset, dict):

        return (
            dataset.get("dataset_name")
            or dataset.get("name")
            or IEEE_CIS_DATASET_NAME
        )

    return getattr(
        dataset,
        "dataset_name",
        IEEE_CIS_DATASET_NAME
    )


# ==================================================
# HELPER: FILE TIMESTAMP
# ==================================================

def _file_timestamp(path: Path):

    if not path.exists():
        return None

    return datetime.fromtimestamp(
        path.stat().st_mtime
    ).isoformat()


# ==================================================
# HELPER: FILE SIGNATURE + RESPONSE CACHES
# ==================================================
#
# The IEEE-CIS transaction CSV has ~590k rows. Reading it on
# every page load makes /dataset/overview (~1 column) and
# /dataset/statistics (full file) take tens of seconds.
# These caches key on file mtime+size, so repeat loads are
# instant while any file change recomputes. Shapes are
# unchanged. The DB-backed activeDatasetId is always resolved
# fresh and is NOT part of the cached payload.
# ==================================================

def _file_sig(path: Path):

    try:

        stat = path.stat()

        return (
            stat.st_mtime_ns,
            stat.st_size
        )

    except OSError:

        return None


_OVERVIEW_CACHE = {
    "key": None,
    "payload": None,
}

_STATISTICS_CACHE = {
    "key": None,
    "payload": None,
}


def _resolve_active_dataset_id(db, fallback: str) -> str:
    """
    DB row that clean/preprocess/smote/feature/train endpoints
    accept. Prefers the latest train_transaction.csv row so the
    Dataset page never sends a file-only or "current" ID.
    """

    try:

        row = (
            db.query(DatasetModel)
            .filter(
                DatasetModel.original_filename ==
                "train_transaction.csv"
            )
            .order_by(
                DatasetModel.upload_date.desc()
            )
            .first()
        )

        if row is not None:

            return str(row.id)

    except Exception:

        pass

    return fallback


# ==================================================
# HELPER: COUNT CSV ROWS
# ==================================================

def _count_csv_rows(path: Path):

    if not path.exists():
        return 0

    with open(
        path,
        "r",
        encoding="utf-8",
        errors="ignore"
    ) as file:

        return max(
            sum(1 for _ in file) - 1,
            0
        )


# ==================================================
# DATASET OVERVIEW
# ==================================================

@router.get("/overview")
def get_dataset_overview(
    db: Session = Depends(get_db)
):

    try:

        # --------------------------------------------------
        # IEEE-CIS is the active dataset
        # --------------------------------------------------

        dataset_id = IEEE_CIS_DATASET_ID

        dataset_name = IEEE_CIS_DATASET_NAME

        # --------------------------------------------------
        # Check raw transaction file
        # --------------------------------------------------

        if not IEEE_CIS_TRANSACTION_FILE.exists():

            raise HTTPException(
                status_code=404,
                detail=(
                    "IEEE-CIS transaction dataset "
                    "not found."
                )
            )

        # --------------------------------------------------
        # Cache: file-derived fields only. The DB-backed
        # activeDatasetId is always resolved fresh below.
        # --------------------------------------------------

        cache_key = (
            _file_sig(IEEE_CIS_TRANSACTION_FILE),
            _file_sig(IEEE_CIS_IDENTITY_FILE),
        )

        active_dataset_id = _resolve_active_dataset_id(
            db,
            str(dataset_id)
        )

        if (
            _OVERVIEW_CACHE["key"] == cache_key
            and _OVERVIEW_CACHE["payload"] is not None
        ):

            return {
                **dict(_OVERVIEW_CACHE["payload"]),
                "activeDatasetId": active_dataset_id,
            }

        # --------------------------------------------------
        # Dataset dimensions
        # --------------------------------------------------

        header_df = pd.read_csv(
            IEEE_CIS_TRANSACTION_FILE,
            nrows=0
        )

        columns = len(
            header_df.columns
        )

        rows = _count_csv_rows(
            IEEE_CIS_TRANSACTION_FILE
        )

        # --------------------------------------------------
        # Fraud statistics
        # --------------------------------------------------

        target = pd.read_csv(
            IEEE_CIS_TRANSACTION_FILE,
            usecols=["isFraud"]
        )

        fraud_transactions = int(
            target["isFraud"].sum()
        )

        legitimate_transactions = int(
            (target["isFraud"] == 0).sum()
        )

        total_transactions = len(
            target
        )

        fraud_rate = (
            fraud_transactions
            / total_transactions
            if total_transactions > 0
            else 0.0
        )

        # --------------------------------------------------
        # Identity records
        # --------------------------------------------------

        identity_records = _count_csv_rows(
            IEEE_CIS_IDENTITY_FILE
        )

        # --------------------------------------------------
        # Pipeline artifact status
        # --------------------------------------------------

        artifact_status = {

            "raw":
                (
                    IEEE_CIS_TRANSACTION_FILE.exists()
                    and
                    IEEE_CIS_IDENTITY_FILE.exists()
                ),

            "cleaning":
                IEEE_CIS_CLEAN_FILE.exists(),

            "feature_engineering":
                IEEE_CIS_ENGINEERED_FILE.exists(),

            "preprocessing":
                (
                    IEEE_CIS_PREPROCESSED_TRAIN_FILE.exists()
                    and
                    IEEE_CIS_PREPROCESSED_TEST_FILE.exists()
                    and
                    IEEE_CIS_PREPROCESSOR_FILE.exists()
                    and
                    IEEE_CIS_FEATURE_METADATA_FILE.exists()
                ),

            "smote":
                (
                    IEEE_CIS_BALANCED_TRAIN_FILE.exists()
                    and
                    IEEE_CIS_BALANCED_TEST_FILE.exists()
                ),

            "training":
                IEEE_CIS_MODEL_FILE.exists()
        }

        # --------------------------------------------------
        # Overall status
        # --------------------------------------------------

        if all(
            artifact_status.values()
        ):

            frontend_status = "ready"

        elif artifact_status["cleaning"]:

            frontend_status = "processed"

        else:

            frontend_status = "uploaded"

        # --------------------------------------------------
        # Last processed timestamp
        # --------------------------------------------------

        artifact_files = [

            IEEE_CIS_CLEAN_FILE,

            IEEE_CIS_ENGINEERED_FILE,

            IEEE_CIS_PREPROCESSED_TRAIN_FILE,

            IEEE_CIS_PREPROCESSED_TEST_FILE,

            IEEE_CIS_BALANCED_TRAIN_FILE,

            IEEE_CIS_BALANCED_TEST_FILE,

            IEEE_CIS_PREPROCESSOR_FILE,

            IEEE_CIS_FEATURE_METADATA_FILE,

            IEEE_CIS_MODEL_FILE

        ]

        timestamps = [

            artifact.stat().st_mtime

            for artifact in artifact_files

            if artifact.exists()
        ]

        if timestamps:

            last_processed = (
                datetime.fromtimestamp(
                    max(timestamps)
                ).isoformat()
            )

        else:

            last_processed = (
                datetime.now().isoformat()
            )

        # --------------------------------------------------
        # Response (file-derived payload is cached; the
        # DB-backed activeDatasetId was resolved above).
        # --------------------------------------------------

        payload = {

            "datasetId":
                str(dataset_id),

            "name":
                dataset_name,

            "rows":
                int(rows),

            "columns":
                int(columns),

            "fraudTransactions":
                fraud_transactions,

            "legitimateTransactions":
                legitimate_transactions,

            "fraudRate":
                fraud_rate,

            "identityRecords":
                identity_records,

            "status":
                frontend_status,

            "lastProcessed":
                last_processed
        }

        _OVERVIEW_CACHE["key"] = cache_key

        _OVERVIEW_CACHE["payload"] = dict(payload)

        return {
            **payload,
            "activeDatasetId": active_dataset_id,
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== DATASET OVERVIEW ERROR =========="
        )

        traceback.print_exc()

        print(
            "============================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# PIPELINE STAGES
# ==================================================

@router.get("/pipeline-stages")
def get_dataset_pipeline_stages():

    try:

        # --------------------------------------------------
        # RAW
        # --------------------------------------------------

        raw_exists = (
            IEEE_CIS_TRANSACTION_FILE.exists()
            and
            IEEE_CIS_IDENTITY_FILE.exists()
        )

        # --------------------------------------------------
        # CLEANING
        # --------------------------------------------------

        cleaning_exists = (
            IEEE_CIS_CLEAN_FILE.exists()
        )

        # --------------------------------------------------
        # FEATURE ENGINEERING
        # --------------------------------------------------

        feature_exists = (
            IEEE_CIS_ENGINEERED_FILE.exists()
        )

        # --------------------------------------------------
        # PREPROCESSING
        # --------------------------------------------------

        preprocessing_exists = (
            IEEE_CIS_PREPROCESSED_TRAIN_FILE.exists()
            and
            IEEE_CIS_PREPROCESSED_TEST_FILE.exists()
            and
            IEEE_CIS_PREPROCESSOR_FILE.exists()
            and
            IEEE_CIS_FEATURE_METADATA_FILE.exists()
        )

        # --------------------------------------------------
        # SMOTE
        # --------------------------------------------------

        smote_exists = (
            IEEE_CIS_BALANCED_TRAIN_FILE.exists()
            and
            IEEE_CIS_BALANCED_TEST_FILE.exists()
        )

        # --------------------------------------------------
        # MODEL TRAINING
        # --------------------------------------------------

        training_exists = (
            IEEE_CIS_MODEL_FILE.exists()
        )

        # --------------------------------------------------
        # Stages
        # --------------------------------------------------

        stages = [

            {
                "key": "raw",

                "label": "RAW DATA",

                "status":
                    (
                        "completed"
                        if raw_exists
                        else "pending"
                    ),

                "timestamp":
                    _file_timestamp(
                        IEEE_CIS_TRANSACTION_FILE
                    ),

                "details":
                    (
                        "IEEE-CIS transaction and "
                        "identity data available."
                        if raw_exists
                        else
                        "IEEE-CIS raw dataset not found."
                    )
            },

            {
                "key": "cleaning",

                "label": "CLEANING",

                "status":
                    (
                        "completed"
                        if cleaning_exists
                        else "pending"
                    ),

                "timestamp":
                    _file_timestamp(
                        IEEE_CIS_CLEAN_FILE
                    ),

                "details":
                    (
                        "IEEE-CIS cleaned dataset available."
                        if cleaning_exists
                        else
                        "Cleaning artifact not found."
                    )
            },

            {
                "key": "featureEngineering",

                "label": "FEATURE ENGINEERING",

                "status":
                    (
                        "completed"
                        if feature_exists
                        else "pending"
                    ),

                "timestamp":
                    _file_timestamp(
                        IEEE_CIS_ENGINEERED_FILE
                    ),

                "details":
                    (
                        "IEEE-CIS engineered dataset "
                        "with 447 features available."
                        if feature_exists
                        else
                        "Feature engineering artifact not found."
                    )
            },

            {
                "key": "preprocessing",

                "label": "PREPROCESSING",

                "status":
                    (
                        "completed"
                        if preprocessing_exists
                        else "pending"
                    ),

                "timestamp":
                    _file_timestamp(
                        IEEE_CIS_PREPROCESSED_TRAIN_FILE
                    ),

                "details":
                    (
                        "IEEE-CIS preprocessed training "
                        "and testing data available."
                        if preprocessing_exists
                        else
                        "Preprocessing artifacts not found."
                    )
            },

            {
                "key": "smote",

                "label": "SMOTE",

                "status":
                    (
                        "completed"
                        if smote_exists
                        else "pending"
                    ),

                "timestamp":
                    _file_timestamp(
                        IEEE_CIS_BALANCED_TRAIN_FILE
                    ),

                "details":
                    (
                        "IEEE-CIS balanced training "
                        "dataset available."
                        if smote_exists
                        else
                        "Balanced dataset not found."
                    )
            },

            {
                "key": "training",

                "label": "MODEL TRAINING",

                "status":
                    (
                        "completed"
                        if training_exists
                        else "pending"
                    ),

                "timestamp":
                    _file_timestamp(
                        IEEE_CIS_MODEL_FILE
                    ),

                "details":
                    (
                        "IEEE-CIS XGBoost fraud "
                        "detection model available."
                        if training_exists
                        else
                        "Trained model not found."
                    )
            }
        ]

        return {

            "datasetId":
                str(IEEE_CIS_DATASET_ID),

            "stages":
                stages
        }

    except Exception as e:

        print(
            "\n========== PIPELINE STAGES ERROR =========="
        )

        traceback.print_exc()

        print(
            "===========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# DATASET STATISTICS
# ==================================================

@router.get("/statistics")
def get_dataset_statistics():

    try:

        transaction_file = (
            IEEE_CIS_TRANSACTION_FILE
        )

        identity_file = (
            IEEE_CIS_IDENTITY_FILE
        )

        # --------------------------------------------------
        # Check dataset
        # --------------------------------------------------

        if not transaction_file.exists():

            raise HTTPException(
                status_code=404,
                detail=(
                    "IEEE-CIS transaction dataset "
                    "not found."
                )
            )

        # --------------------------------------------------
        # Cache: the full 590k-row read below takes tens of
        # seconds; serve the cached payload when neither the
        # transaction nor identity file changed.
        # --------------------------------------------------

        stats_key = (
            _file_sig(transaction_file),
            _file_sig(identity_file),
        )

        if (
            _STATISTICS_CACHE["key"] == stats_key
            and _STATISTICS_CACHE["payload"] is not None
        ):

            return dict(_STATISTICS_CACHE["payload"])

        # --------------------------------------------------
        # Fraud target
        # --------------------------------------------------

        target_df = pd.read_csv(
            transaction_file,
            usecols=["isFraud"]
        )

        fraud_count = int(
            target_df["isFraud"].sum()
        )

        legitimate_count = int(
            (
                target_df["isFraud"] == 0
            ).sum()
        )

        fraud_vs_legitimate = [

            {
                "name": "Fraud",
                "value": fraud_count
            },

            {
                "name": "Legitimate",
                "value": legitimate_count
            }
        ]

        # --------------------------------------------------
        # Full transaction dataset
        # --------------------------------------------------

        full_df = pd.read_csv(
            transaction_file
        )

        # --------------------------------------------------
        # Missing values
        # --------------------------------------------------

        missing_counts = (
            full_df
            .isna()
            .sum()
            .sort_values(
                ascending=False
            )
            .head(10)
        )

        missing_values = [

            {
                "feature":
                    str(column),

                "missing":
                    int(value)
            }

            for column, value
            in missing_counts.items()
        ]

        # --------------------------------------------------
        # Numeric features
        # --------------------------------------------------

        numeric_columns = (
            full_df
            .select_dtypes(
                include=["number"]
            )
            .columns
        )

        numeric_columns = [

            column

            for column
            in numeric_columns

            if column != "isFraud"
            and column != "TransactionID"
        ]

        # --------------------------------------------------
        # Feature distribution
        # --------------------------------------------------

        sample_size = min(
            50000,
            len(full_df)
        )

        if sample_size > 0:

            sample_df = (
                full_df[numeric_columns]
                .sample(
                    n=sample_size,
                    random_state=42
                )
            )

        else:

            sample_df = full_df[
                numeric_columns
            ]

        feature_distribution = []

        for column in numeric_columns[:30]:

            series = (
                sample_df[column]
                .dropna()
            )

            if len(series) == 0:
                continue

            feature_distribution.append({

                "feature":
                    str(column),

                "mean":
                    float(
                        series.mean()
                    ),

                "std":
                    float(
                        series.std()
                        if len(series) > 1
                        else 0
                    ),

                "min":
                    float(
                        series.min()
                    ),

                "max":
                    float(
                        series.max()
                    )
            })

        # --------------------------------------------------
        # Identity coverage
        # --------------------------------------------------

        identity_coverage = []

        if identity_file.exists():

            identity_df = pd.read_csv(
                identity_file
            )

            identity_rows = len(
                identity_df
            )

            if (
                "TransactionID"
                in identity_df.columns
                and
                "TransactionID"
                in full_df.columns
            ):

                transaction_ids = set(
                    full_df[
                        "TransactionID"
                    ]
                )

                identity_matches = (
                    identity_df[
                        "TransactionID"
                    ]
                    .isin(
                        transaction_ids
                    )
                    .sum()
                )

                coverage = (
                    identity_matches
                    / len(full_df)
                    if len(full_df)
                    else 0
                )

                identity_coverage.append({

                    "field":
                        "Identity records",

                    "coverage":
                        float(
                            coverage
                        )
                })

            if identity_rows:

                identity_coverage.append({

                    "field":
                        "Identity dataset",

                    "coverage":
                        float(
                            identity_rows
                            / len(full_df)
                        )
                        if len(full_df)
                        else 0
                })

        # --------------------------------------------------
        # Response
        # --------------------------------------------------

        payload = {

            "datasetId":
                str(
                    IEEE_CIS_DATASET_ID
                ),

            "fraudVsLegitimate":
                fraud_vs_legitimate,

            "missingValues":
                missing_values,

            "featureDistribution":
                feature_distribution,

            "identityCoverage":
                identity_coverage
        }

        _STATISTICS_CACHE["key"] = stats_key

        _STATISTICS_CACHE["payload"] = dict(payload)

        return dict(payload)

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== DATASET STATISTICS ERROR =========="
        )

        traceback.print_exc()

        print(
            "==============================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# UPLOAD DATASET + AUTOMATIC PIPELINE
# ==================================================

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    try:

        dataset = save_dataset(
            file,
            db
        )

        dataset_id = dataset["id"]

        pipeline_result = run_dataset_pipeline(
            dataset_id,
            db
        )

        return {

            "message":
                "Dataset uploaded and processed successfully.",

            "dataset":
                dataset,

            "pipeline":
                pipeline_result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== UPLOAD PIPELINE ERROR =========="
        )

        traceback.print_exc()

        print(
            "===========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# CLEAN DATASET
# ==================================================

@router.post("/clean/{dataset_id}")
def clean_uploaded_dataset(
    dataset_id: UUID,
    db: Session = Depends(get_db)
):

    try:

        result = clean_dataset(
            dataset_id,
            db
        )

        return {

            "message":
                "Dataset cleaned successfully.",

            "cleaning":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== CLEANING ERROR =========="
        )

        traceback.print_exc()

        print(
            "===================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# PREPROCESS DATASET
# ==================================================

@router.post("/preprocess/{dataset_id}")
def preprocess_uploaded_dataset(
    dataset_id: UUID,
    db: Session = Depends(get_db)
):

    try:

        result = preprocess_dataset(
            dataset_id,
            db
        )

        return {

            "message":
                "Dataset preprocessed successfully.",

            "preprocessing":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== PREPROCESSING ERROR =========="
        )

        traceback.print_exc()

        print(
            "========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# SMOTE
# ==================================================

@router.post("/smote/{dataset_id}")
def apply_smote_to_dataset(
    dataset_id: UUID,
    db: Session = Depends(get_db)
):

    try:

        result = apply_smote(
            dataset_id,
            db
        )

        return {

            "message":
                "SMOTE applied successfully.",

            "smote":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== SMOTE ERROR =========="
        )

        traceback.print_exc()

        print(
            "================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# FEATURE ENGINEERING
# ==================================================

@router.post("/feature-engineering/{dataset_id}")
def perform_feature_engineering(
    dataset_id: UUID,
    db: Session = Depends(get_db)
):

    try:

        result = feature_engineering(
            dataset_id,
            db
        )

        return {

            "message":
                "Feature engineering completed successfully.",

            "feature_engineering":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== FEATURE ENGINEERING ERROR =========="
        )

        traceback.print_exc()

        print(
            "==============================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# TRAIN / TEST SPLIT
# ==================================================

@router.post("/train-test-split/{dataset_id}")
def train_test_split_dataset(
    dataset_id: UUID,
    db: Session = Depends(get_db)
):

    try:

        result = prepare_training_dataset(
            dataset_id,
            db
        )

        return {

            "message":
                "Training dataset created successfully.",

            "training":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== TRAIN/TEST SPLIT ERROR =========="
        )

        traceback.print_exc()

        print(
            "===========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# TRAIN XGBOOST
# ==================================================

@router.post("/train/{dataset_id}")
def train_fraud_detection_model(
    dataset_id: UUID,
    db: Session = Depends(get_db)
):

    try:

        result = train_xgboost_model(
            dataset_id,
            db
        )

        return {

            "message":
                "XGBoost model trained successfully.",

            "training":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== MODEL TRAINING ERROR =========="
        )

        traceback.print_exc()

        print(
            "=========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# FRAUD PREDICTION
# ==================================================

@router.post("/predict/{dataset_id}")
def predict_fraud(
    dataset_id: UUID,
    request: PredictionRequest,
    db: Session = Depends(get_db)
):

    try:

        result = predict_transaction(
            dataset_id,
            request.transaction,
            db
        )

        return {

            "message":
                "Fraud prediction completed successfully.",

            "prediction":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== PREDICTION ERROR =========="
        )

        traceback.print_exc()

        print(
            "====================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# BATCH FRAUD PREDICTION
# ==================================================

@router.post("/predict-batch/{dataset_id}")
async def predict_fraud_batch(
    dataset_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    try:

        if (
            not file.filename
            or
            not file.filename.lower().endswith(".csv")
        ):

            raise HTTPException(
                status_code=400,
                detail="Only CSV files are supported."
            )

        contents = await file.read()

        try:

            df = pd.read_csv(
                io.BytesIO(contents)
            )

        except Exception as e:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unable to parse CSV file: {str(e)}"
                )
            )

        result = predict_transactions_batch(
            dataset_id,
            df,
            db
        )

        return {

            "message":
                "Batch fraud prediction completed successfully.",

            "result":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== BATCH PREDICTION ERROR =========="
        )

        traceback.print_exc()

        print(
            "============================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# LATEST DATASET STATUS
# ==================================================

@router.get("/latest")
def get_latest_dataset_status(
    db: Session = Depends(get_db)
):

    try:

        result = get_latest_dataset(
            db
        )

        return {

            "message":
                "Latest dataset retrieved successfully.",

            "result":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== LATEST DATASET ERROR =========="
        )

        traceback.print_exc()

        print(
            "==========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# DATASET HISTORY
# ==================================================

@router.get("/history")
def get_dataset_history_status(
    db: Session = Depends(get_db)
):

    try:

        result = get_dataset_history(
            db
        )

        return {

            "message":
                "Dataset history retrieved successfully.",

            "history":
                result
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "\n========== DATASET HISTORY ERROR =========="
        )

        traceback.print_exc()

        print(
            "==========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==================================================
# SERVE MODEL GRAPHS
# ==================================================

@router.get("/graphs/{dataset_id}/{filename}")
def get_dataset_graph(
    dataset_id: UUID,
    filename: str
):

    allowed_files = {

        "confusion_matrix.png",

        "roc_curve.png",

        "feature_importance.png"
    }

    if filename not in allowed_files:

        raise HTTPException(
            status_code=400,
            detail="Invalid graph filename."
        )

    graph_file = (
        GRAPH_PATH
        / str(dataset_id)
        / filename
    )

    if not graph_file.exists():

        raise HTTPException(
            status_code=404,
            detail="Graph not found."
        )

    return FileResponse(
        path=str(graph_file),
        media_type="image/png",
        filename=filename
    )