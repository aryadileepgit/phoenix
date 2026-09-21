import { apiClient, extractErrorMessage } from "./datasetService";
import type {
  RawTransactionListResponse,
  RawTransactionDetailResponse,
  TransactionSummary,
  TransactionRecord,
  TransactionListFilters,
  ScoreTransactionInput,
  ScoreTransactionResult,
} from "../types/transaction";

export interface TransactionListResult {
  summary: TransactionSummary;
  transactions: TransactionRecord[];
}

/**
 * ==========================================================
 * LIST TRANSACTIONS
 * ==========================================================
 *
 * Backend endpoint:
 * GET /transactions?prediction=&search=&limit=&offset=
 *
 * Summary counts always reflect the full table; the
 * `transactions` array reflects filters + pagination. All
 * prediction fields are stored XGBoost outputs.
 */
export async function getTransactions(
  filters: TransactionListFilters = {}
): Promise<TransactionListResult> {
  try {
    const params: Record<string, string | number> = {};

    if (filters.prediction && filters.prediction !== "all") {
      params.prediction = filters.prediction;
    }

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.limit !== undefined) {
      params.limit = filters.limit;
    }

    if (filters.offset !== undefined) {
      params.offset = filters.offset;
    }

    const response = await apiClient.get<RawTransactionListResponse>(
      "/transactions",
      { params }
    );

    return {
      summary: response.data.summary,
      transactions: response.data.transactions,
    };
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * ==========================================================
 * GET TRANSACTION BY ID
 * ==========================================================
 *
 * Backend endpoint:
 * GET /transactions/{transaction_id}
 */
export async function getTransactionById(
  id: string
): Promise<TransactionRecord> {
  try {
    const response =
      await apiClient.get<RawTransactionDetailResponse>(
        `/transactions/${encodeURIComponent(id)}`
      );
    return response.data.transaction;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * ==========================================================
 * SCORE TRANSACTION
 * ==========================================================
 *
 * Backend endpoint:
 * POST /transactions/score
 *
 * The backend (never the frontend) runs schema evolution +
 * the trained XGBoost model and persists the scored row.
 * Returns the flat TransactionResponse schema.
 */
export async function scoreTransaction(
  input: ScoreTransactionInput
): Promise<ScoreTransactionResult> {
  try {
    const response = await apiClient.post<ScoreTransactionResult>(
      "/transactions/score",
      input
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
