from pathlib import Path

import pandas as pd

from fastapi import (
    HTTPException,
    UploadFile
)

from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.user import User

from app.services.validation_service import (
    validate_dataset
)

from app.models.dataset_validation import (
    DatasetValidation
)


# ==================================================
# Storage
# ==================================================

RAW_DATASET_PATH = Path(
    "storage/raw"
)


# ==================================================
# Save Dataset
# ==================================================

def save_dataset(
    file: UploadFile,
    db: Session
):

    try:

        print(
            "========== DATASET UPLOAD STARTED =========="
        )

        # ------------------------------------------
        # Create storage folder
        # ------------------------------------------

        RAW_DATASET_PATH.mkdir(
            parents=True,
            exist_ok=True
        )

        print(
            "✓ Storage folder ready"
        )

        # ------------------------------------------
        # Validate filename
        # ------------------------------------------

        if not file.filename:

            raise HTTPException(
                status_code=400,
                detail="Filename is missing."
            )

        if not file.filename.lower().endswith(".csv"):

            raise HTTPException(
                status_code=400,
                detail="Only CSV files are supported."
            )

        # ------------------------------------------
        # Save uploaded file
        # ------------------------------------------

        file_path = (
            RAW_DATASET_PATH /
            file.filename
        )

        with open(
            file_path,
            "wb"
        ) as buffer:

            buffer.write(
                file.file.read()
            )

        print(
            f"✓ File saved: {file.filename}"
        )

        # ------------------------------------------
        # Read CSV
        # ------------------------------------------

        try:

            df = pd.read_csv(
                file_path
            )

        except Exception as e:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unable to read CSV file: {str(e)}"
                )
            )

        print(
            f"✓ CSV Loaded "
            f"({len(df)} rows, "
            f"{len(df.columns)} columns)"
        )

        # ------------------------------------------
        # Create preview
        # ------------------------------------------

        preview = (
            df.head(10)
            .fillna("")
            .to_dict(
                orient="records"
            )
        )

        # ------------------------------------------
        # Find administrator
        # ------------------------------------------

        admin = (
            db.query(User)
            .filter(
                User.email ==
                "ayoradileep@gmail.com"
            )
            .first()
        )

        if admin is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Administrator account not found."
                )
            )

        print(
            f"✓ Admin Found: {admin.email}"
        )

        # ------------------------------------------
        # Create Dataset record
        # ------------------------------------------

        dataset = Dataset(

            dataset_name=
                file.filename.replace(
                    ".csv",
                    ""
                ),

            original_filename=
                file.filename,

            total_records=
                len(df),

            total_columns=
                len(df.columns),

            uploaded_by=
                admin.id,

            status=
                "Uploaded",

            remarks=
                "Initial dataset uploaded."
        )

        print(
            "✓ Dataset object created"
        )

        db.add(
            dataset
        )

        db.commit()

        db.refresh(
            dataset
        )

        print(
            "✓ Dataset saved to database"
        )

        # ==========================================
        # DATASET VALIDATION
        # ==========================================

        print(
            "\n========== DATASET VALIDATION =========="
        )

        validation = validate_dataset(
            df
        )

        # ------------------------------------------
        # Save validation report
        # ------------------------------------------

        validation_report = DatasetValidation(

            dataset_id=
                dataset.id,

            total_rows=
                validation["total_rows"],

            total_columns=
                validation["total_columns"],

            missing_values=
                validation["missingValues"],

            duplicate_rows=
                validation["duplicateRows"],

            validation_status=
                validation["validationStatus"]
        )

        db.add(
            validation_report
        )

        db.commit()

        db.refresh(
            validation_report
        )

        print(
            "✓ Validation report saved"
        )

        print(
            "========================================"
        )

        # ==========================================
        # RETURN DATASET
        # ==========================================

        return {

            "id":
                str(dataset.id),

            "filename":
                dataset.original_filename,

            "rows":
                dataset.total_records,

            "columns":
                dataset.total_columns,

            "status":
                dataset.status,

            "validation":
                validation,

            "preview":
                preview
        }


    # ==============================================
    # Preserve HTTP errors
    # ==============================================

    except HTTPException:

        db.rollback()

        raise


    # ==============================================
    # Unexpected errors
    # ==============================================

    except Exception as e:

        db.rollback()

        print(
            "\n========== DATASET UPLOAD ERROR =========="
        )

        print(
            type(e).__name__
        )

        print(
            str(e)
        )

        print(
            "==========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Dataset upload failed: {str(e)}"
            )
        )