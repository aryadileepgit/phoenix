import pandas as pd


def validate_dataset(df: pd.DataFrame):

    print("========== DATASET VALIDATION ==========")

    required_columns = [
        "step",
        "type",
        "amount",
        "nameOrig",
        "oldbalanceOrg",
        "newbalanceOrig",
        "nameDest",
        "oldbalanceDest",
        "newbalanceDest",
        "isFraud",
        "isFlaggedFraud",
    ]

    print("\nCSV Columns:")

    for column in df.columns:
        print(f"'{column}'")

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    missing_values = int(df.isnull().sum().sum())

    duplicate_rows = int(df.duplicated().sum())

    csv_format_valid = True

    required_columns_present = len(missing_columns) == 0

    validation_status = (
        "Passed"
        if required_columns_present
        else "Failed"
    )

    print("\nMissing Columns:")
    print(missing_columns)

    print(f"\nTotal Rows: {len(df)}")
    print(f"Total Columns: {len(df.columns)}")
    print(f"Missing Values: {missing_values}")
    print(f"Duplicate Rows: {duplicate_rows}")

    print(f"\nValidation Status: {validation_status}")

    print("========================================")

    return {
        "total_rows": len(df),
        "total_columns": len(df.columns),

        # Frontend fields
        "csvFormatValid": csv_format_valid,
        "requiredColumnsPresent": required_columns_present,
        "missingColumns": missing_columns,
        "missingValues": missing_values,
        "duplicateRows": duplicate_rows,
        "validationStatus": validation_status,
    }