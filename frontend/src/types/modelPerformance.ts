/**
 * Mirrors backend/app/api/routes/model.py.
 * pr_auc/pr_curve come from model_metadata.json: stored at
 * retraining promotion time, backfilled for older models on the
 * untouched IEEE test set. Null when never recorded.
 */
export interface ModelInfo {
  model_name: string;
  algorithm: string;
  features: number;
  training_rows: number;
  test_rows: number;
  status: string;
  is_best_model: boolean;
  model_path: string;
  trained_at: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  pr_auc: number | null;
}

export interface RocCurve {
  fpr: number[];
  tpr: number[];
  thresholds: number[];
}

export interface PrCurve {
  precision: number[];
  recall: number[];
  thresholds: number[];
  note?: string;
}

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface PreviousVersion {
  version: string;
  status: string;
  roc_auc: number;
}

export interface ModelPerformanceData {
  model_info: ModelInfo;
  metrics: ModelMetrics;
  roc_curve: RocCurve | null;
  pr_curve: PrCurve | null;
  confusion_matrix: ConfusionMatrix | null;
  feature_importance: FeatureImportanceItem[] | null;
  previous_version: PreviousVersion | null;
}
