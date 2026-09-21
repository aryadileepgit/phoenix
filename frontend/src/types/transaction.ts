/**
 * Mirrors backend/app/api/routes/transactions.py::_serialize_transaction()
 * over the Transaction model. All prediction fields are the stored
 * XGBoost outputs (snake_case, flat responses).
 */
export interface TransactionRecord {
  id: string;
  transaction_id: string;
  account_id: string;
  amount: number;
  transaction_time: string;
  product_code: string | null;
  card_information: Record<string, unknown> | null;
  device_information: Record<string, unknown> | null;
  additional_data: Record<string, unknown> | null;
  fraud_probability: number | null;
  predicted_label: boolean | null;
  risk_level: string | null;
  decision: string | null;
  actual_label: boolean | null;
  created_at: string;
}

export interface TransactionSummary {
  total_transactions: number;
  fraud_count: number;
  legitimate_count: number;
  /** Percent number, e.g. 2.5 means 2.5%. */
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
 * Raw response shape of GET /transactions/{transaction_id}
 */
export interface RawTransactionDetailResponse {
  message: string;
  transaction: TransactionRecord;
}

export type PredictionFilter = "all" | "fraud" | "legitimate";

export interface TransactionListFilters {
  prediction?: PredictionFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Canonical score request. Mirrors TransactionCreate:
 * transaction_id, account_id, amount, transaction_time are
 * required; the rest is optional context for the model.
 */
export interface ScoreTransactionInput {
  transaction_id: string;
  account_id: string;
  amount: number;
  transaction_time: string;
  product_code?: string | null;
  card_information?: Record<string, unknown> | null;
  device_information?: Record<string, unknown> | null;
  additional_data?: Record<string, unknown> | null;
}

/**
 * POST /transactions/score returns the TransactionResponse
 * schema directly (flat, unwrapped).
 */
export interface ScoreTransactionResult {
  transaction_id: string;
  account_id: string;
  amount: number;
  transaction_time: string;
  fraud_probability: number | null;
  predicted_label: boolean | null;
  risk_level: string | null;
  decision: string | null;
}

/**
 * POST /transactions/explain returns the stored-style scoring
 * fields plus SHAP attributions from the trained model.
 */
export interface ExplainFeature {
  feature: string;
  value: unknown;
  shap_value: number;
  impact: "INCREASES_FRAUD_RISK" | "DECREASES_FRAUD_RISK";
}

export interface ExplainTransactionResult {
  transaction_id: string;
  fraud_probability: number | null;
  predicted_label: boolean | null;
  risk_level: string | null;
  decision: string | null;
  top_explanations: ExplainFeature[];
}
