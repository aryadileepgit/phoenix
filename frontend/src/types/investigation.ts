/**
 * Investigation workspace contracts. There is no standalone
 * case-management API; triage comes from the account endpoints:
 * - GET /transactions/accounts (watchlist source)
 * - GET /transactions/account/{id}/investigation (triage)
 * - GET /transactions/account/{id}/risk (risk + factors)
 * Triage status is derived per account, not a stored case state.
 */

export type TriageStatus =
  | "HIGH_PRIORITY"
  | "REVIEW"
  | "NO_SUSPICIOUS_ACTIVITY";

export interface WatchlistEntry {
  account_id: string;
  transaction_count: number;
  fraud_predictions: number;
  highest_fraud_probability: number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  /** Honest triage heuristic shown in the UI as such. */
  triage_hint: string;
}
