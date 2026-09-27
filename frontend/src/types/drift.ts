/**
 * Mirrors backend/app/api/routes/drift.py.
 * Detection runs on scored API transactions (reference = older
 * half, recent = newer half). Retraining is never triggered
 * automatically; decisions belong to the adaptive agent.
 */

export type DriftFeatureStatus = "STABLE" | "WARNING" | "DRIFT";

export interface DriftFeature {
  feature: string;
  ks_statistic: number;
  p_value: number;
  drift_status: DriftFeatureStatus;
  reference_mean: number;
  reference_std: number;
  recent_mean: number;
  recent_std: number;
  reference_size: number;
  recent_size: number;
}

export interface DriftEventItem {
  id: string;
  ks_score: number;
  threshold: number;
  severity: "Low" | "Medium" | "High";
  drift_detected: boolean;
  timestamp: string;
}

export interface FraudRatePoint {
  date: string | null;
  fraud_rate: number;
  total: number;
}

export interface DriftStatusState {
  ks_score: number;
  threshold: number;
  drift_detected: boolean;
  last_check: string | null;
  reference_size: number | null;
  recent_size: number | null;
  features_monitored: number;
  drifted_features: number | null;
  fraud_rate_change: number | null;
  fraud_rate_threshold: number;
  severity: string | null;
  drift_event_id: string | null;
  note?: string;
}

export interface DriftStatusResponse {
  status: DriftStatusState;
  features: DriftFeature[];
  /** True when features are a live snapshot, not a persisted run. */
  snapshot_only: boolean;
  events: DriftEventItem[];
  fraud_rate_history: FraudRatePoint[];
}

export interface RetrainingGate {
  triggered: boolean;
  reason: string | null;
  job_id: string | null;
  action: string | null;
  state?: string | null;
}

export interface DriftRunResult {
  drift_detected: boolean;
  ks_score: number;
  threshold: number;
  severity: string;
  fraud_rate_change: number;
  fraud_rate_threshold: number;
  drift_event_id: string;
  features: DriftFeature[];
  reference_size: number;
  recent_size: number;
  retraining: RetrainingGate | null;
}
