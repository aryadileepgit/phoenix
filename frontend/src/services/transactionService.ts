import { apiClient, extractErrorMessage } from "./datasetService";
import type {
  RawTransactionListResponse,
  RawTransactionDetailResponse,
  TransactionSummary,
  TransactionRecord,
  TransactionListFilters,
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
 * GET /transactions
 *
 * Summary counts always reflect the full table; the `transactions`
 * array respects whatever filters are passed.
 */
export async function getTransactions(
  filters: TransactionListFilters = {}
): Promise<TransactionListResult> {
  try {
    const params: Record<string, string> = {};

    if (filters.prediction && filters.prediction !== "all") {
      params.prediction = filters.prediction;
    }

    if (filters.transactionType) {
      params.transaction_type = filters.transactionType;
    }

    if (filters.search) {
      params.search = filters.search;
    }

    const response = await apiClient.get<RawTransactionListResponse>("/transactions", {
      params,
    });

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
 * GET /transactions/{id}
 */
export async function getTransactionById(id: string): Promise<TransactionRecord> {
  try {
    const response = await apiClient.get<RawTransactionDetailResponse>(`/transactions/${id}`);
    return response.data.transaction;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
