import { apiClient, extractErrorMessage } from "./datasetService";
import type {
  AdaptiveState,
  AdaptiveDecision,
} from "../types/adaptive";

/**
 * Backend: GET /adaptive/state — agent constants, latest drift
 * event, Q-table rows, last decision, retraining history table
 * (empty until a real run is recorded), model evaluation.
 */
export async function getAdaptiveLearning(): Promise<AdaptiveState> {
  try {
    const response =
      await apiClient.get<AdaptiveState>("/adaptive/state");
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Backend: POST /adaptive/decide — runs the Q-learning agent
 * against the latest drift event and returns its action.
 * Never retrains a model. Returns 400 when no drift event
 * exists yet (run drift detection first).
 */
export async function requestAdaptiveDecision(
  driftEventId?: string
): Promise<AdaptiveDecision> {
  try {
    const response = await apiClient.post<AdaptiveDecision>(
      "/adaptive/decide",
      driftEventId ? { drift_event_id: driftEventId } : {}
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
