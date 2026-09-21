/**
 * Account contracts mirror the backend source of truth:
 * - GET /transactions/accounts (flat { accounts, total_accounts })
 * - GET /transactions/account/{id}/risk
 * - GET /transactions/account/{id}/history
 * - GET /transactions/account/{id}/investigation
 *
 * Accounts are API-supplied identifiers (Transaction.account_id,
 * e.g. simulator ACC_* IDs) grouped over scored transactions.
 * IEEE-CIS itself has no native account column.
 */

export type AccountRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AccountSummary {
  account_id: string;
  transaction_count: number;
  total_amount: number;
  fraud_predictions: number;
  highest_fraud_probability: number | null;
  risk_level: AccountRiskLevel;
}

export interface AccountsData {
  accounts: AccountSummary[];
  total_accounts: number;
}

export interface AccountRiskResponse {
  account_id: string;
  account_risk: AccountRiskLevel;
  risk_score: number;
  investigation_required: boolean;
  total_transactions: number;
  suspicious_transactions: number;
  high_risk_transactions: number;
  recent_suspicious_transactions: number;
  suspicious_rate: number;
  average_fraud_probability: number;
  latest_fraud_probability: number | null;
  latest_risk_level: string | null;
  latest_decision: string | null;
  risk_factors: string[];
}

export interface AccountHistoryItem {
  transaction_id: string;
  amount: number;
  transaction_time: string;
  fraud_probability: number | null;
  predicted_label: boolean | null;
  risk_level: string | null;
  decision: string | null;
  actual_label: boolean | null;
}

export interface AccountHistoryResponse {
  account_id: string;
  total_transactions: number;
  transactions: AccountHistoryItem[];
}

export interface AccountInvestigationResponse {
  account_id: string;
  investigation_status:
    | "HIGH_PRIORITY"
    | "REVIEW"
    | "NO_SUSPICIOUS_ACTIVITY";
  total_transactions: number;
  suspicious_transaction_count: number;
  high_risk_transaction_count: number;
  total_suspicious_amount: number;
  highest_risk_transaction: {
    transaction_id: string;
    amount: number;
    transaction_time: string;
    fraud_probability: number;
    risk_level: string | null;
    decision: string | null;
  } | null;
  suspicious_transactions: AccountHistoryItem[];
}
