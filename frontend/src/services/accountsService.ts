import { apiClient } from "./datasetService";
import type {
  AccountsData,
  AccountHistoryResponse,
  AccountInvestigationResponse,
  AccountRiskResponse,
} from "../types/accounts";

/**
 * Account-level aggregates over scored API transactions.
 * Backend: GET /transactions/accounts
 */
export async function getAccounts(): Promise<AccountsData> {
  try {
    const response = await apiClient.get<AccountsData>(
      "/transactions/accounts"
    );
    return response.data;
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to load accounts."
    );
  }
}

/**
 * Rule-based risk for one account (thresholds 0.30 / 0.70).
 * Backend: GET /transactions/account/{account_id}/risk
 */
export async function getAccountRisk(
  accountId: string
): Promise<AccountRiskResponse> {
  try {
    const response = await apiClient.get<AccountRiskResponse>(
      `/transactions/account/${encodeURIComponent(accountId)}/risk`
    );
    return response.data;
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : "Failed to load account risk."
    );
  }
}

/**
 * Full scored transaction history for one account.
 * Backend: GET /transactions/account/{account_id}/history
 */
export async function getAccountHistory(
  accountId: string
): Promise<AccountHistoryResponse> {
  try {
    const response = await apiClient.get<AccountHistoryResponse>(
      `/transactions/account/${encodeURIComponent(accountId)}/history`
    );
    return response.data;
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : "Failed to load account history."
    );
  }
}

/**
 * Suspicious-activity triage for one account.
 * Backend: GET /transactions/account/{account_id}/investigation
 */
export async function getAccountInvestigation(
  accountId: string
): Promise<AccountInvestigationResponse> {
  try {
    const response =
      await apiClient.get<AccountInvestigationResponse>(
        `/transactions/account/${encodeURIComponent(accountId)}/investigation`
      );
    return response.data;
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : "Failed to load account investigation."
    );
  }
}
