/**
 * -----------------------------
 * Validation
 * -----------------------------
 */

export interface ValidationReport {
  total_rows?: number;
  total_columns?: number;

  csvFormatValid?: boolean;
  requiredColumnsPresent?: boolean;

  missingColumns?: string[];

  missingValues?: number;
  duplicateRows?: number;

  validationStatus?: string;
}

/**
 * -----------------------------
 * Dataset Information
 * -----------------------------
 */

export interface DatasetInfo {
  id: string;

  filename?: string;

  datasetName?: string;

  originalFilename?: string;

  rows?: number;

  columns?: number;

  status?: string;

  fileSize?: number;

  uploadTime?: string;

  validation?: ValidationReport;
}

/**
 * Dataset Preview
 */

export type DatasetPreviewRow = Record<
  string,
  string | number | boolean | null
>;

/**
 * Upload Response
 */

export interface DatasetUploadResponse {
  dataset: DatasetInfo;
  preview?: DatasetPreviewRow[];
}

/**
 * -----------------------------
 * Dataset History
 * -----------------------------
 *
 * Shape returned by GET /dataset/history. Mirrors the columns already
 * rendered by DatasetHistory.tsx.
 */

export interface DatasetHistoryItem {
  id: string;

  datasetName?: string;

  uploadTime?: string;

  status?: string;

  rows?: number;

  validationStatus?: string;

  cleaningStatus?: string;

  currentStage?: string;
}

/**
 * -----------------------------
 * RAW Backend Response
 * -----------------------------
 */

export interface RawValidationPayload {
  total_rows?: number;
  total_columns?: number;

  csvFormatValid?: boolean;
  requiredColumnsPresent?: boolean;

  missingColumns?: string[];

  missingValues?: number;
  duplicateRows?: number;

  validationStatus?: string;
}

export interface RawDataset {
  id: string;

  filename?: string;

  rows?: number;

  columns?: number;

  status?: string;

  validation?: RawValidationPayload;
}

export interface RawDatasetUploadResponse {
  message: string;

  dataset: RawDataset;

  preview?: DatasetPreviewRow[];
}

/**
 * -----------------------------
 * Cleaning
 * -----------------------------
 */

export interface CleaningReport {
  dataset_id?: string;

  rows_before?: number;

  rows_after?: number;

  duplicates_removed?: number;

  missing_values_fixed?: number;

  output_file?: string;

  status?: string;
}

export interface CleanDatasetResponse {
  message?: string;

  cleaning: CleaningReport;
}

/**
 * -----------------------------
 * Preprocessing
 * -----------------------------
 */

export interface PreprocessingReport {
  dataset_id?: string;

  rows_processed?: number;

  categorical_encoded?: number;

  numerical_scaled?: number;

  output_file?: string;

  status?: string;
}

export interface PreprocessDatasetResponse {
  message?: string;

  preprocessing: PreprocessingReport;
}

/**
 * -----------------------------
 * SMOTE
 * -----------------------------
 */

export interface SmoteReport {
  dataset_id?: string;

  rows_before?: number;

  rows_after?: number;

  fraud_before?: number;

  fraud_after?: number;

  percentage_increase?: number;

  output_file?: string;

  status?: string;
}

export interface SmoteResponse {
  message?: string;

  smote: SmoteReport;
}

/**
 * -----------------------------
 * Feature Engineering
 * -----------------------------
 */

export interface FeatureEngineeringReport {
  dataset_id?: string;

  original_features?: number;

  engineered_features?: number;

  new_features_created?: number;

  output_file?: string;

  status?: string;
}

export interface FeatureEngineeringResponse {
  message?: string;

  feature_engineering: FeatureEngineeringReport;
}

/**
 * -----------------------------
 * Train Test Split
 * -----------------------------
 */

export interface TrainTestSplitReport {
  dataset_id?: string;

  training_rows?: number;

  testing_rows?: number;

  total_features?: number;

  output_folder?: string;

  status?: string;
}

export interface TrainTestSplitResponse {
  message?: string;

  training: TrainTestSplitReport;
}