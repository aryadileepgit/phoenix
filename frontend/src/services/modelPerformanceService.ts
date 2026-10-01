import { apiClient, extractErrorMessage } from "./datasetService";
import type { ModelPerformanceData } from "../types/modelPerformance";

/**
 * Backend: GET /model/performance — latest stored ModelReport
 * plus training metadata. pr_auc/pr_curve come from
 * model_metadata.json (stored at promotion, backfilled for
 * older models); null when never recorded.
 */
export async function getModelPerformance(): Promise<ModelPerformanceData> {
  try {
    const response =
      await apiClient.get<ModelPerformanceData>(
        "/model/performance"
      );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
