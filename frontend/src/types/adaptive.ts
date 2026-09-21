/**
 * Mirrors backend/app/api/routes/adaptive.py.
 * The agent is real but has no recorded retraining runs;
 * history is an empty array until one genuinely occurs.
 */

export type AdaptiveAction =
  | "IGNORE"
  | "RETRAIN_RECENT"
  | "FULL_RETRAIN";

export interface AdaptiveAgent {
  alpha: number;
  gamma: number;
  epsilon: number;
  actions: AdaptiveAction[];
}

export interface DriftEventRef {
  id: string;
  ks_score: number;
  threshold: number;
  severity: string;
  drift_detected: boolean;
  detected_at: string;
}

export interface QTableRow {
  state: string;
  action: string;
  reward: number;
  q_value: number;
  recorded_at: string;
}

export interface LastDecision {
  state: string;
  action: string;
  reward: number;
  q_value: number;
  recorded_at: string;
}

export interface RetrainingRecord {
  id: string;
  action: string;
  reward: number;
  training_duration_seconds: number;
  completed_at: string;
}

export interface ModelEvaluation {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
}

export interface AdaptiveState {
  agent: AdaptiveAgent;
  latest_drift_event: DriftEventRef | null;
  last_decision: LastDecision | null;
  q_table: QTableRow[];
  retraining_history: RetrainingRecord[];
  model_evaluation: ModelEvaluation | null;
}

export interface AdaptiveDecision {
  message: string;
  drift_event_id: string;
  state: string;
  action: string;
  q_values: Record<string, number>;
  epsilon: number;
}
