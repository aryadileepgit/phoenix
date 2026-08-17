/**
 * Mirrors app/api/routes/transactions.py::_serialize().
 */
export interface TransactionRecord {
  id: string;
  dataset_id: string;
  step: number;
  type: string;
  amount: number;
  sender: string | null;
  sender_balance_before: number | null;
  sender_balance_after: number | null;
  receiver: string | null;
  receiver_balance_before: number | null;
  receiver_balance_after: number | null;
  actual_label: boolean | null;
  predicted_label: boolean | null;
  fraud_probability: number | null;
  created_at: string;
}

export interface TransactionSummary {
  total_transactions: number;
  fraud_count: number;
  legitimate_count: number;
  fraud_rate: number;
}

/**
 * Raw response shape of GET /transactions
 */
export interface RawTransactionListResponse {
  message: string;
  summary: TransactionSummary;
  transactions: TransactionRecord[];
}

/**
 * Raw response shape of GET /transactions/{id}
 */
export interface RawTransactionDetailResponse {
  message: string;
  transaction: TransactionRecord;
}

export type PredictionFilter = "all" | "fraud" | "legitimate";

export interface TransactionListFilters {
  prediction?: PredictionFilter;
  transactionType?: string;
  search?: string;
}
