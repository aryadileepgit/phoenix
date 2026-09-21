import { apiClient } from "./datasetService";
import { getTransactionById } from "./transactionService";
import type {
  TransactionRecord,
  ExplainTransactionResult,
  ScoreTransactionInput,
} from "../types/transaction";

/**
 * Stored scored row.
 * Backend: GET /transactions/{transaction_id}
 */
export async function getTransactionDetail(
  transactionId: string
): Promise<TransactionRecord> {
  return getTransactionById(transactionId);
}

/**
 * SHAP attributions from the trained model (not persisted).
 * Backend: POST /transactions/explain with a TransactionCreate
 * body reconstructed from the stored row.
 */
export async function explainTransaction(
  input: ScoreTransactionInput
): Promise<ExplainTransactionResult> {
  try {
    const response =
      await apiClient.post<ExplainTransactionResult>(
        "/transactions/explain",
        input
      );
    return response.data;
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : "Failed to load SHAP explanation."
    );
  }
}
