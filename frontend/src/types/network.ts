/**
 * Mirrors backend/app/api/routes/transactions.py:get_account_network().
 * Relationships are shared card/device/data attributes observed on
 * stored transactions — investigation signals, not proof of fraud.
 */

export interface SharedAttribute {
  type: string;
  field: string;
  value: string;
}

export interface NetworkTransaction {
  transaction_id: string;
  amount: number;
  transaction_time: string;
  fraud_probability: number | null;
  risk_level: string | null;
  decision: string | null;
}

export interface ConnectedAccount {
  account_id: string;
  shared_attributes: SharedAttribute[];
  transactions: NetworkTransaction[];
  suspicious_transactions: number;
  highest_fraud_probability: number;
  network_risk: "LOW" | "MEDIUM" | "HIGH";
  transaction_count: number;
}

export interface NetworkResponse {
  account_id: string;
  network_status: "CONNECTED" | "NO_CONNECTED_ACCOUNTS";
  connected_account_count: number;
  connected_accounts: ConnectedAccount[];
}
