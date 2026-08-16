from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset

from app.services.cleaning_service import clean_dataset
from app.services.preprocessing_service import preprocess_dataset
from app.services.smote_service import apply_smote
from app.services.feature_engineering_service import feature_engineering
from app.services.training_service import prepare_training_dataset
from app.services.model_training_service import train_xgboost_model


def run_dataset_pipeline(
    dataset_id,
    db: Session
):
    """
    Runs the complete Phoenix fraud detection
    pipeline for one uploaded dataset.
    """

    # -----------------------------------------
    # Find dataset
    # -----------------------------------------

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id
    ).first()

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    # -----------------------------------------
    # Initial status
    # -----------------------------------------

    dataset.status = "Processing"
    dataset.remarks = "Dataset pipeline processing started."
    db.commit()
    db.refresh(dataset)

    # -----------------------------------------
    # Track pipeline progress
    # -----------------------------------------

    pipeline_status = {
        "cleaning": "Pending",
        "preprocessing": "Pending",
        "smote": "Pending",
        "feature_engineering": "Pending",
        "train_test_split": "Pending",
        "xgboost_training": "Pending"
    }

    try:
        # =========================================
        # 1. CLEANING
        # =========================================
        print("\n========================================")
        print("PIPELINE STEP 1: CLEANING")
        print("========================================")

        cleaning_result = clean_dataset(dataset_id, db)
        pipeline_status["cleaning"] = "Completed"

        # =========================================
        # 2. PREPROCESSING
        # =========================================
        print("\n========================================")
        print("PIPELINE STEP 2: PREPROCESSING")
        print("========================================")

        preprocessing_result = preprocess_dataset(dataset_id, db)
        pipeline_status["preprocessing"] = "Completed"

        # =========================================
        # 3. SMOTE
        # =========================================
        print("\n========================================")
        print("PIPELINE STEP 3: SMOTE")
        print("========================================")

        smote_result = apply_smote(dataset_id, db)
        pipeline_status["smote"] = "Completed"

        # =========================================
        # 4. FEATURE ENGINEERING
        # =========================================
        print("\n========================================")
        print("PIPELINE STEP 4: FEATURE ENGINEERING")
        print("========================================")

        feature_engineering_result = feature_engineering(dataset_id, db)
        pipeline_status["feature_engineering"] = "Completed"

        # =========================================
        # 5. TRAIN / TEST SPLIT
        # =========================================
        print("\n========================================")
        print("PIPELINE STEP 5: TRAIN / TEST SPLIT")
        print("========================================")

        training_result = prepare_training_dataset(dataset_id, db)
        pipeline_status["train_test_split"] = "Completed"

        # =========================================
        # 6. XGBOOST TRAINING
        # =========================================
        print("\n========================================")
        print("PIPELINE STEP 6: XGBOOST TRAINING")
        print("========================================")

        model_result = train_xgboost_model(dataset_id, db)
        pipeline_status["xgboost_training"] = "Completed"

        # =========================================
        # PIPELINE SUCCESS
        # =========================================
        dataset.status = "Ready"
        dataset.remarks = "Dataset processed successfully and fraud detection model is ready."
        db.commit()
        db.refresh(dataset)

        print("\n========================================")
        print("PHOENIX PIPELINE COMPLETED")
        print("========================================")

        return {
            "dataset_id": str(dataset.id),
            "dataset_name": dataset.dataset_name,
            "status": "Ready",
            "pipeline_status": pipeline_status,
            "cleaning": cleaning_result,
            "preprocessing": preprocessing_result,
            "smote": smote_result,
            "feature_engineering": feature_engineering_result,
            "training": training_result,
            "model": model_result
        }

    except HTTPException as e:
        # -----------------------------------------
        # Pipeline failed
        # -----------------------------------------
        dataset.status = "Failed"
        dataset.remarks = f"Pipeline failed: {e.detail}"
        db.commit()
        raise

    except Exception as e:
        # -----------------------------------------
        # Unexpected failure
        # -----------------------------------------
        dataset.status = "Failed"
        dataset.remarks = f"Pipeline failed: {str(e)}"
        db.commit()

        print("\n========================================")
        print("PHOENIX PIPELINE FAILED")
        print("========================================")
        print("Error:", str(e))
        print("Pipeline status:", pipeline_status)
        print("========================================\n")

        raise HTTPException(
            status_code=500,
            detail={
                "message": "Dataset pipeline failed.",
                "error": str(e),
                "pipeline_status": pipeline_status
            }
        )
