import { apiClient, extractErrorMessage } from "./datasetService";
import type { NetworkResponse } from "../types/network";

/**
 * Shared-attribute network for one account.
 * Backend: GET /transactions/network/{account_id}
 * Returns the full graph payload in a single call.
 */
export async function getNetwork(
  accountId: string
): Promise<NetworkResponse> {
  try {
    const response = await apiClient.get<NetworkResponse>(
      `/transactions/network/${encodeURIComponent(accountId)}`
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
