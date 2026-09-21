import { apiClient, extractErrorMessage } from "./datasetService";
import { getAccounts } from "./accountsService";
import type { WatchlistEntry } from "../types/investigation";

/**
 * Watchlist of accounts needing attention, derived from the
 * real accounts aggregation: predicted fraud present, HIGH
 * max-probability risk, or repeated suspicious volume.
 */
export async function getWatchlist(): Promise<WatchlistEntry[]> {
  try {
    const { accounts } = await getAccounts();
    return accounts
      .filter(
        (a) =>
          a.fraud_predictions > 0 || a.risk_level !== "LOW"
      )
      .map((a) => ({
        account_id: a.account_id,
        transaction_count: a.transaction_count,
        fraud_predictions: a.fraud_predictions,
        highest_fraud_probability: a.highest_fraud_probability,
        risk_level: a.risk_level,
        triage_hint:
          a.fraud_predictions > 0
            ? "Predicted fraud present"
            : a.risk_level === "HIGH"
              ? "High max fraud probability"
              : "Elevated max fraud probability",
      }));
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export { getAccountInvestigation } from "./accountsService";
export { getAccountRisk } from "./accountsService";
export { getAccountHistory } from "./accountsService";
