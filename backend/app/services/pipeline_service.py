from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset

from app.services.cleaning_service import clean_dataset
from app.services.feature_engineering_service import feature_engineering
from app.services.training_service import prepare_training_dataset
from app.services.preprocessing_service import preprocess_dataset
from app.services.smote_service import apply_smote
from app.services.model_training_service import train_xgboost_model


def run_dataset_pipeline(
    dataset_id,
    db: Session
):
    """
    Runs the complete Phoenix fraud detection pipeline.

    Pipeline order:

    1. Cleaning
    2. Feature Engineering
    3. Train / Test Split
    4. Preprocessing
    5. SMOTE on training data only
    6. XGBoost Training
    """

    # -----------------------------------------
    # Find dataset
    # -----------------------------------------

    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id)
        .first()
    )

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    # -----------------------------------------
    # Initial status
    # -----------------------------------------

    dataset.status = "Processing"
    dataset.remarks = (
        "Phoenix fraud detection pipeline processing started."
    )

    db.commit()
    db.refresh(dataset)

    # -----------------------------------------
    # Track pipeline progress
    # -----------------------------------------

    pipeline_status = {
        "cleaning": "Pending",
        "feature_engineering": "Pending",
        "train_test_split": "Pending",
        "preprocessing": "Pending",
        "smote": "Pending",
        "xgboost_training": "Pending"
    }

    try:

        # =========================================
        # 1. CLEANING
        # =========================================

        print("\n========================================")
        print("PHOENIX STEP 1: CLEANING")
        print("========================================")

        cleaning_result = clean_dataset(
            dataset_id,
            db
        )

        pipeline_status["cleaning"] = "Completed"

        print("Cleaning completed.")

        # =========================================
        # 2. FEATURE ENGINEERING
        # =========================================

        print("\n========================================")
        print("PHOENIX STEP 2: FEATURE ENGINEERING")
        print("========================================")

        feature_engineering_result = feature_engineering(
            dataset_id,
            db
        )

        pipeline_status["feature_engineering"] = "Completed"

        print("Feature engineering completed.")

        # =========================================
        # 3. TRAIN / TEST SPLIT
        # =========================================

        print("\n========================================")
        print("PHOENIX STEP 3: TRAIN / TEST SPLIT")
        print("========================================")

        training_result = prepare_training_dataset(
            dataset_id,
            db
        )

        pipeline_status["train_test_split"] = "Completed"

        print("Train/test split completed.")

        # =========================================
        # 4. PREPROCESSING
        # =========================================

        print("\n========================================")
        print("PHOENIX STEP 4: PREPROCESSING")
        print("========================================")

        preprocessing_result = preprocess_dataset(
            dataset_id,
            db
        )

        pipeline_status["preprocessing"] = "Completed"

        print("Preprocessing completed.")

        # =========================================
        # 5. SMOTE
        # =========================================

        print("\n========================================")
        print("PHOENIX STEP 5: SMOTE")
        print("========================================")

        smote_result = apply_smote(
            dataset_id,
            db
        )

        pipeline_status["smote"] = "Completed"

        print("SMOTE completed.")

        # =========================================
        # 6. XGBOOST TRAINING
        # =========================================

        print("\n========================================")
        print("PHOENIX STEP 6: XGBOOST TRAINING")
        print("========================================")

        model_result = train_xgboost_model(
            dataset_id,
            db
        )

        pipeline_status["xgboost_training"] = "Completed"

        print("XGBoost training completed.")

        # =========================================
        # PIPELINE SUCCESS
        # =========================================

        dataset.status = "Ready"

        dataset.remarks = (
            "Phoenix fraud detection pipeline completed successfully."
        )

        db.commit()
        db.refresh(dataset)

        print("\n========================================")
        print("PHOENIX PIPELINE COMPLETED SUCCESSFULLY")
        print("========================================")

        print("Pipeline status:")
        print(pipeline_status)

        # -----------------------------------------
        # Return complete pipeline result
        # -----------------------------------------

        return {
            "dataset_id": str(dataset.id),
            "dataset_name": dataset.dataset_name,
            "status": "Ready",
            "pipeline_status": pipeline_status,

            "cleaning": cleaning_result,

            "feature_engineering":
                feature_engineering_result,

            "training":
                training_result,

            "preprocessing":
                preprocessing_result,

            "smote":
                smote_result,

            "model":
                model_result
        }

    # =============================================
    # EXPECTED PIPELINE ERROR
    # =============================================

    except HTTPException as e:

        dataset.status = "Failed"

        dataset.remarks = (
            f"Pipeline failed: {e.detail}"
        )

        db.commit()

        print("\n========================================")
        print("PHOENIX PIPELINE FAILED")
        print("========================================")

        print("Error:", e.detail)
        print("Pipeline status:")
        print(pipeline_status)

        print("========================================\n")

        raise

    # =============================================
    # UNEXPECTED ERROR
    # =============================================

    except Exception as e:

        dataset.status = "Failed"

        dataset.remarks = (
            f"Pipeline failed: {str(e)}"
        )

        db.commit()

        print("\n========================================")
        print("PHOENIX PIPELINE FAILED")
        print("========================================")

        print("Error:", str(e))

        print("Pipeline status:")
        print(pipeline_status)

        print("========================================\n")

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "Phoenix dataset pipeline failed.",

                "error":
                    str(e),

                "pipeline_status":
                    pipeline_status
            }
        )