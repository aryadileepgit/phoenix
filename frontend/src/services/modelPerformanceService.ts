import { apiClient, extractErrorMessage } from "./datasetService";
import type { ModelPerformanceData } from "../types/modelPerformance";

/**
 * Backend: GET /model/performance — latest stored ModelReport
 * plus training metadata. Precision-recall data was never
 * stored, so pr_auc/pr_curve are explicit nulls.
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
