from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.dataset_validation import DatasetValidation
from app.models.dataset_cleaning import DatasetCleaning
from app.models.preprocessing_report import PreprocessingReport
from app.models.smote_report import SMOTEReport
from app.models.feature_engineering_report import FeatureEngineeringReport
from app.models.training_report import TrainingReport


def get_pipeline_history(db: Session):
    datasets = (
        db.query(Dataset)
        .order_by(Dataset.upload_time.desc())
        .all()
    )

    history = []

    for dataset in datasets:

        validation = (
            db.query(DatasetValidation)
            .filter(DatasetValidation.dataset_id == dataset.id)
            .first()
        )

        cleaning = (
            db.query(DatasetCleaning)
            .filter(DatasetCleaning.dataset_id == dataset.id)
            .first()
        )

        preprocessing = (
            db.query(PreprocessingReport)
            .filter(PreprocessingReport.dataset_id == dataset.id)
            .first()
        )

        smote = (
            db.query(SMOTEReport)
            .filter(SMOTEReport.dataset_id == dataset.id)
            .first()
        )

        feature = (
            db.query(FeatureEngineeringReport)
            .filter(FeatureEngineeringReport.dataset_id == dataset.id)
            .first()
        )

        training = (
            db.query(TrainingReport)
            .filter(TrainingReport.dataset_id == dataset.id)
            .first()
        )

        history.append(
            {
                "id": dataset.id,
                "datasetName": dataset.filename,
                "uploadTime": dataset.upload_time,
                "rows": dataset.rows,
                "status": dataset.status,

                "validationStatus": (
                    validation.validation_status
                    if validation
                    else "Pending"
                ),

                "cleaningStatus": (
                    cleaning.status
                    if cleaning
                    else "Pending"
                ),

                "preprocessingStatus": (
                    preprocessing.status
                    if preprocessing
                    else "Pending"
                ),

                "smoteStatus": (
                    smote.status
                    if smote
                    else "Pending"
                ),

                "featureEngineeringStatus": (
                    feature.status
                    if feature
                    else "Pending"
                ),

                "trainingStatus": (
                    training.status
                    if training
                    else "Pending"
                ),
            }
        )

    return history