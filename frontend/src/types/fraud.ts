/**
 * -----------------------------
 * Model Performance
 * -----------------------------
 *
 * Mirrors app/services/dataset_status_service.py::get_latest_dataset()
 * and the structured chart data now persisted by
 * app/services/model_training_service.py (confusion matrix / ROC
 * curve / feature importance — previously PNG-only, now real JSON).
 */

export interface ConfusionMatrixData {
  matrix: number[][];
  labels: [string, string];
  true_negative: number;
  false_positive: number;
  false_negative: number;
  true_positive: number;
}

export interface RocCurveData {
  fpr: number[];
  tpr: number[];
  auc: number;
}

export interface FeatureImportanceEntry {
  feature: string;
  importance: number;
}

export interface ModelReportInfo {
  id?: string;
  model_name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  train_rows: number;
  test_rows: number;
  model_path?: string;
  is_best_model?: boolean;
  status: string;
  confusion_matrix: ConfusionMatrixData | null;
  roc_curve: RocCurveData | null;
  feature_importance: FeatureImportanceEntry[] | null;
  created_at?: string;
}

export interface TrainingReportInfo {
  training_rows: number;
  testing_rows: number;
  total_features: number;
  output_folder?: string;
  status: string;
  created_at?: string;
}

export interface LatestDatasetSummary {
  id: string;
  dataset_name?: string;
  original_filename?: string;
  total_records?: number;
  total_columns?: number;
  status?: string;
  remarks?: string;
  upload_date?: string;
}

export interface LatestDatasetStatus {
  dataset: LatestDatasetSummary;
  model: ModelReportInfo | null;
  training: TrainingReportInfo | null;
}

/**
 * Raw response shape of GET /dataset/latest
 */
export interface RawLatestDatasetResponse {
  message: string;
  result: LatestDatasetStatus;
}

/**
 * -----------------------------
 * Batch Fraud Prediction
 * -----------------------------
 *
 * Mirrors app/services/prediction_service.py::predict_transactions_batch(),
 * called via POST /dataset/predict-batch/{datasetId}.
 */

export interface BatchPredictionResultRow {
  transaction_id: string;
  type: string;
  amount: number;
  predicted_label: number;
  result: "Fraud" | "Legitimate" | string;
  fraud_probability: number;
  legitimate_probability: number;
  created_at?: string;
}

export interface BatchPredictionSummary {
  total_transactions: number;
  fraud_count: number;
  legitimate_count: number;
  fraud_rate: number;
}

export interface BatchPredictionResult {
  dataset_id: string;
  dataset_name?: string;
  model: string;
  summary: BatchPredictionSummary;
  results: BatchPredictionResultRow[];
}

/**
 * Raw response shape of POST /dataset/predict-batch/{datasetId}
 */
export interface RawBatchPredictionResponse {
  message: string;
  result: BatchPredictionResult;
}
