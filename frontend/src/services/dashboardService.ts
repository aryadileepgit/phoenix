import { apiClient, extractErrorMessage } from "./datasetService";
import { getTransactions } from "./transactionService";
import { getLatestDatasetStatus } from "./fraudDetectionService";
import type { TransactionRecord } from "../types/transaction";

export interface RecentActivityEvent {
  type: "dataset_upload" | "model_trained" | "batch_analyzed";
  title: string;
  detail: string | null;
  timestamp: string;
}

interface RawActivityResponse {
  message: string;
  activity: RecentActivityEvent[];
}

interface RawDatasetHistoryResponse {
  message: string;
  history: {
    total_datasets: number;
    datasets: unknown[];
  };
}

export interface DashboardData {
  datasetsLoaded: number;
  totalTransactions: number;
  fraudDetected: number;
  legitimateCount: number;
  fraudRate: number;
  modelAccuracy: number | null;
  modelName: string | null;
  transactions: TransactionRecord[];
  activity: RecentActivityEvent[];
}

/**
 * Pulls everything the Dashboard needs from real endpoints and
 * assembles it into one object. No section of this is fabricated —
 * anything without a real backend source (drift events, schema
 * changes) is simply left out here; the page shows an honest empty
 * state for those instead.
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [historyRes, latestStatus, transactionsRes, activityRes] = await Promise.all([
      apiClient.get<RawDatasetHistoryResponse>("/dataset/history"),
      getLatestDatasetStatus().catch(() => null),
      getTransactions({ prediction: "all" }),
      apiClient.get<RawActivityResponse>("/activity"),
    ]);

    return {
      datasetsLoaded: historyRes.data.history.total_datasets,
      totalTransactions: transactionsRes.summary.total_transactions,
      fraudDetected: transactionsRes.summary.fraud_count,
      legitimateCount: transactionsRes.summary.legitimate_count,
      fraudRate: transactionsRes.summary.fraud_rate,
      modelAccuracy: latestStatus?.model?.accuracy ?? null,
      modelName: latestStatus?.model?.model_name ?? null,
      transactions: transactionsRes.transactions,
      activity: activityRes.data.activity,
    };
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
