export interface DatasetOverviewData {
  datasetId: string;
  /** DB Dataset row that pipeline actions accept; falls back to datasetId. */
  activeDatasetId?: string | null;
  name: string;
  status: "uploaded" | "processed" | "ready" | "error";
  rows: number;
  columns: number;
  fraudTransactions: number;
  legitimateTransactions: number;
  fraudRate: number;
  identityRecords: number;
  lastProcessed: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
  timestamp?: string;
  details?: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

export interface DatasetStatistics {
  datasetId?: string;
  fraudVsLegitimate: { name: string; value: number }[];
  missingValues: { feature: string; missing: number; percentage?: number }[];
  featureDistribution: { feature: string; mean: number; std: number; min: number; max: number }[];
  identityCoverage: { field: string; coverage: number }[];
}

/**
 * Saved XGBoost model metadata surfaced by GET /dataset/latest.
 * Read-only on the Dataset page: never triggers training.
 */
export interface TrainedModelInfo {
  id?: string;
  model_name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  train_rows: number;
  test_rows: number;
  status?: string;
  created_at?: string;
}