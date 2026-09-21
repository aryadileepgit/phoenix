import { apiClient, extractErrorMessage } from "./datasetService";
import type { DashboardData } from "../types/dashboard";

/**
 * Backend: GET /dashboard — aggregates over stored rows only
 * (scored transactions, latest model report, latest drift
 * event, schema registry). No synthesized metrics.
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    const response =
      await apiClient.get<DashboardData>("/dashboard");
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
