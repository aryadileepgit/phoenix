from pathlib import Path

import joblib
import pandas as pd

from fastapi import HTTPException
from sqlalchemy.orm import Session

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

from app.models.dataset import Dataset
from app.models.preprocessing_report import PreprocessingReport


TRAINING_PATH = Path("storage/training")
PREPROCESSED_PATH = Path("storage/preprocessed")
PREPROCESSING_MODEL_PATH = Path("storage/preprocessing_models")

TARGET_COLUMN = "isFraud"


TRANSACTION_CATEGORICAL_COLUMNS = [
    "ProductCD",
    "card1",
    "card2",
    "card3",
    "card4",
    "card5",
    "card6",
    "addr1",
    "addr2",
    "P_emaildomain",
    "R_emaildomain",
    "M1",
    "M2",
    "M3",
    "M4",
    "M5",
    "M6",
    "M7",
    "M8",
    "M9",
    "DeviceType",
    "DeviceInfo",
]


def get_identity_categorical_columns(df):
    return [
        column
        for column in df.columns
        if column.startswith("id_")
        and column[3:].isdigit()
        and 12 <= int(column[3:]) <= 38
    ]


def get_categorical_columns(df):

    categorical_columns = []

    for column in TRANSACTION_CATEGORICAL_COLUMNS:
        if column in df.columns:
            categorical_columns.append(column)

    for column in get_identity_categorical_columns(df):
        if column not in categorical_columns:
            categorical_columns.append(column)

    for column in df.select_dtypes(
        include=["object", "string", "category"]
    ).columns:

        if column not in categorical_columns:
            categorical_columns.append(column)

    return categorical_columns


def normalize_categorical_columns(df, categorical_columns):
    """
    Convert categorical values to strings.

    IEEE-CIS contains columns where values can be a mixture
    of numbers and strings. OrdinalEncoder requires a
    consistent value type, so categorical values are
    normalized to strings before encoding.
    """

    df = df.copy()

    for column in categorical_columns:

        if column in df.columns:

            df[column] = df[column].apply(
                lambda value: "Unknown"
                if pd.isna(value)
                else str(value)
            )

    return df


def preprocess_dataset(dataset_id, db: Session):

    PREPROCESSED_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    PREPROCESSING_MODEL_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    # ---------------------------------------------------------
    # Find dataset
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # Locate training split
    # ---------------------------------------------------------

    training_folder = (
        TRAINING_PATH / str(dataset_id)
    )

    if not training_folder.exists():

        raise HTTPException(
            status_code=404,
            detail="Training split not found. Run train-test split first."
        )

    x_train_path = training_folder / "X_train.csv"
    y_train_path = training_folder / "y_train.csv"
    x_test_path = training_folder / "X_test.csv"
    y_test_path = training_folder / "y_test.csv"

    required_files = [
        x_train_path,
        y_train_path,
        x_test_path,
        y_test_path
    ]

    for file_path in required_files:

        if not file_path.exists():

            raise HTTPException(
                status_code=404,
                detail=f"Required file not found: {file_path.name}"
            )

    # ---------------------------------------------------------
    # Read training and testing data
    # ---------------------------------------------------------

    try:

        X_train = pd.read_csv(
            x_train_path
        )

        y_train = pd.read_csv(
            y_train_path
        )

        X_test = pd.read_csv(
            x_test_path
        )

        y_test = pd.read_csv(
            y_test_path
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to read training data: {str(exc)}"
        )

    # ---------------------------------------------------------
    # Extract target from y_train
    # ---------------------------------------------------------

    if TARGET_COLUMN in y_train.columns:

        y_train = y_train[TARGET_COLUMN]

    elif len(y_train.columns) == 1:

        y_train = y_train.iloc[:, 0]

    else:

        raise HTTPException(
            status_code=400,
            detail="Invalid y_train file."
        )

    # ---------------------------------------------------------
    # Extract target from y_test
    # ---------------------------------------------------------

    if TARGET_COLUMN in y_test.columns:

        y_test = y_test[TARGET_COLUMN]

    elif len(y_test.columns) == 1:

        y_test = y_test.iloc[:, 0]

    else:

        raise HTTPException(
            status_code=400,
            detail="Invalid y_test file."
        )

    # ---------------------------------------------------------
    # Validate target values
    # ---------------------------------------------------------

    if not set(
        y_train.dropna().unique()
    ).issubset({0, 1}):

        raise HTTPException(
            status_code=400,
            detail="y_train must contain only 0 and 1."
        )

    if not set(
        y_test.dropna().unique()
    ).issubset({0, 1}):

        raise HTTPException(
            status_code=400,
            detail="y_test must contain only 0 and 1."
        )

    # ---------------------------------------------------------
    # Remove identifier columns
    # ---------------------------------------------------------

    identifier_columns = []

    if "TransactionID" in X_train.columns:

        identifier_columns.append(
            "TransactionID"
        )

    X_train = X_train.drop(
        columns=identifier_columns,
        errors="ignore"
    )

    X_test = X_test.drop(
        columns=identifier_columns,
        errors="ignore"
    )

    # ---------------------------------------------------------
    # Keep only common columns
    # ---------------------------------------------------------

    common_columns = [
        column
        for column in X_train.columns
        if column in X_test.columns
    ]

    X_train = X_train[
        common_columns
    ]

    X_test = X_test[
        common_columns
    ]

    # ---------------------------------------------------------
    # Remove features with >50% missing values
    #
    # IMPORTANT:
    # The decision is based ONLY on X_train.
    # ---------------------------------------------------------

    missing_ratio = X_train.isnull().mean()

    high_missing_columns = (
        missing_ratio[
            missing_ratio > 0.50
        ]
        .index
        .tolist()
    )

    X_train = X_train.drop(
        columns=high_missing_columns,
        errors="ignore"
    )

    X_test = X_test.drop(
        columns=high_missing_columns,
        errors="ignore"
    )

    # ---------------------------------------------------------
    # Identify categorical columns
    # ---------------------------------------------------------

    categorical_columns = (
        get_categorical_columns(
            X_train
        )
    )

    # ---------------------------------------------------------
    # Identify numerical columns
    # ---------------------------------------------------------

    numerical_columns = [
        column
        for column in X_train.columns
        if column not in categorical_columns
    ]

    # ---------------------------------------------------------
    # Normalize categorical values
    #
    # Fixes IEEE-CIS mixed float/string columns.
    # ---------------------------------------------------------

    X_train = normalize_categorical_columns(
        X_train,
        categorical_columns
    )

    X_test = normalize_categorical_columns(
        X_test,
        categorical_columns
    )

    # ---------------------------------------------------------
    # Numerical preprocessing
    # ---------------------------------------------------------

    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                )
            )
        ]
    )

    # ---------------------------------------------------------
    # Categorical preprocessing
    # ---------------------------------------------------------

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="constant",
                    fill_value="Unknown"
                )
            ),
            (
                "encoder",
                OrdinalEncoder(
                    handle_unknown="use_encoded_value",
                    unknown_value=-1
                )
            )
        ]
    )

    # ---------------------------------------------------------
    # Create ColumnTransformer
    # ---------------------------------------------------------

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numerical",
                numerical_pipeline,
                numerical_columns
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_columns
            )
        ],
        remainder="drop",
        verbose_feature_names_out=False
    )

    # ---------------------------------------------------------
    # Fit on training data
    # Transform test data using same fitted preprocessor
    # ---------------------------------------------------------

    try:

        X_train_processed = (
            preprocessor.fit_transform(
                X_train
            )
        )

        X_test_processed = (
            preprocessor.transform(
                X_test
            )
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Preprocessing failed: {str(exc)}"
        )

    # ---------------------------------------------------------
    # Get final feature names
    # ---------------------------------------------------------

    feature_names = (
        preprocessor
        .get_feature_names_out()
    )

    # ---------------------------------------------------------
    # Convert processed arrays to DataFrames
    # ---------------------------------------------------------

    X_train_processed = pd.DataFrame(
        X_train_processed,
        columns=feature_names
    )

    X_test_processed = pd.DataFrame(
        X_test_processed,
        columns=feature_names
    )

    # ---------------------------------------------------------
    # Add target column back
    # ---------------------------------------------------------

    X_train_processed[
        TARGET_COLUMN
    ] = y_train.reset_index(drop=True)

    X_test_processed[
        TARGET_COLUMN
    ] = y_test.reset_index(drop=True)

    dataset_name = dataset.dataset_name

    # ---------------------------------------------------------
    # Output file paths
    # ---------------------------------------------------------

    train_output_file = (
        PREPROCESSED_PATH
        / f"{dataset_name}_train_preprocessed.csv"
    )

    test_output_file = (
        PREPROCESSED_PATH
        / f"{dataset_name}_test_preprocessed.csv"
    )

    # ---------------------------------------------------------
    # Save processed training data
    # ---------------------------------------------------------

    X_train_processed.to_csv(
        train_output_file,
        index=False
    )

    # ---------------------------------------------------------
    # Save processed testing data
    # ---------------------------------------------------------

    X_test_processed.to_csv(
        test_output_file,
        index=False
    )

    # ---------------------------------------------------------
    # Preprocessor and metadata paths
    # ---------------------------------------------------------

    preprocessor_file = (
        PREPROCESSING_MODEL_PATH
        / f"{dataset_name}_preprocessor.joblib"
    )

    metadata_file = (
        PREPROCESSING_MODEL_PATH
        / f"{dataset_name}_feature_metadata.joblib"
    )

    # ---------------------------------------------------------
    # Metadata
    # ---------------------------------------------------------

    metadata = {

        "dataset_id":
            str(dataset_id),

        "dataset_name":
            dataset_name,

        "target_column":
            TARGET_COLUMN,

        "identifier_columns_removed":
            identifier_columns,

        "high_missing_columns_removed":
            high_missing_columns,

        "high_missing_threshold":
            0.50,

        "categorical_columns":
            categorical_columns,

        "numerical_columns":
            numerical_columns,

        "total_features":
            len(feature_names),

        "training_rows":
            len(X_train_processed),

        "testing_rows":
            len(X_test_processed)
    }

    # ---------------------------------------------------------
    # Save fitted preprocessor
    # ---------------------------------------------------------

    joblib.dump(
        preprocessor,
        preprocessor_file
    )

    # ---------------------------------------------------------
    # Save feature metadata
    # ---------------------------------------------------------

    joblib.dump(
        metadata,
        metadata_file
    )

    # ---------------------------------------------------------
    # Database report
    # ---------------------------------------------------------

    report = PreprocessingReport(

        dataset_id=dataset.id,

        rows_processed=len(X_train_processed),

        categorical_encoded=len(categorical_columns),

        numerical_scaled=0,

        output_file=str(
            train_output_file
        ),

        status="Completed"
    )

    db.add(report)

    db.commit()

    db.refresh(report)

    # ---------------------------------------------------------
    # Return response
    # ---------------------------------------------------------

    return {

        "dataset_id":
            str(dataset_id),

        "dataset_name":
            dataset_name,

        "training_rows":
            len(X_train_processed),

        "testing_rows":
            len(X_test_processed),

        "categorical_features":
            len(categorical_columns),

        "numerical_features":
            len(numerical_columns),

        "total_features":
            len(feature_names),

        "identifier_columns_removed":
            identifier_columns,

        "high_missing_columns_removed":
            len(high_missing_columns),

        "high_missing_threshold":
            0.50,

        "numerical_scaled":
            0,

        "train_file":
            train_output_file.name,

        "test_file":
            test_output_file.name,

        "preprocessor_file":
            preprocessor_file.name,

        "metadata_file":
            metadata_file.name,

        "status":
            "Completed"
    }