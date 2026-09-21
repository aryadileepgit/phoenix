/**
 * Mirrors backend/app/api/routes/model.py.
 * pr_auc/pr_curve are null: the training pipeline never stored
 * precision-recall data, and Phoenix does not fabricate curves.
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

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface ModelPerformanceData {
  model_info: ModelInfo;
  metrics: ModelMetrics;
  roc_curve: RocCurve | null;
  pr_curve: null;
  confusion_matrix: ConfusionMatrix | null;
  feature_importance: FeatureImportanceItem[] | null;
}
