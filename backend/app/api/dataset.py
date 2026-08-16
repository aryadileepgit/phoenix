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
from app.services.dataset_status_service import (
    get_latest_dataset,
    get_dataset_history
)
from fastapi.responses import FileResponse
from pathlib import Path
# --------------------------------------------------
# Database
# --------------------------------------------------

from app.database.dependencies import get_db


# --------------------------------------------------
# Services
# --------------------------------------------------

from app.services.dataset_service import save_dataset

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
    predict_transaction
)


# --------------------------------------------------
# Schemas
# --------------------------------------------------

from app.schemas.prediction import (
    PredictionRequest
)


# --------------------------------------------------
# Router
# --------------------------------------------------

router = APIRouter(
    prefix="/dataset",
    tags=["Dataset"]
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

        # ------------------------------------------
        # Save uploaded dataset
        # ------------------------------------------

        dataset = save_dataset(
            file,
            db
        )

        # ------------------------------------------
        # Get dataset ID
        # ------------------------------------------

        dataset_id = dataset["id"]

        # ------------------------------------------
        # Run complete Phoenix pipeline
        # ------------------------------------------

        pipeline_result = run_dataset_pipeline(
            dataset_id,
            db
        )

        # ------------------------------------------
        # Return result
        # ------------------------------------------

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

GRAPH_PATH = Path("storage/graphs")


@router.get("/graphs/{dataset_id}/{filename}")
def get_dataset_graph(
    dataset_id: UUID,
    filename: str
):
    # ----------------------------------------------
    # Allow only generated graph files
    # ----------------------------------------------

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

    # ----------------------------------------------
    # Build graph path
    # ----------------------------------------------

    graph_file = (
        GRAPH_PATH /
        str(dataset_id) /
        filename
    )

    # ----------------------------------------------
    # Check file
    # ----------------------------------------------

    if not graph_file.exists():

        raise HTTPException(
            status_code=404,
            detail="Graph not found."
        )

    # ----------------------------------------------
    # Return image
    # ----------------------------------------------

    return FileResponse(
        path=str(graph_file),
        media_type="image/png",
        filename=filename
    )