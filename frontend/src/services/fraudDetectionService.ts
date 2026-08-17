import type { AxiosProgressEvent } from "axios";
import { apiClient, extractErrorMessage } from "./datasetService";
import type {
  LatestDatasetStatus,
  RawLatestDatasetResponse,
  BatchPredictionResult,
  RawBatchPredictionResponse,
} from "../types/fraud";

/**
 * ==========================================================
 * LATEST DATASET STATUS (dataset + model + training)
 * ==========================================================
 *
 * Backend endpoint:
 * GET /dataset/latest
 *
 * Powers the Model Performance section and determines which
 * dataset currently has a trained model available for prediction.
 */
export async function getLatestDatasetStatus(): Promise<LatestDatasetStatus> {
  try {
    const response = await apiClient.get<RawLatestDatasetResponse>("/dataset/latest");
    return response.data.result;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * ==========================================================
 * BATCH FRAUD PREDICTION (CSV UPLOAD)
 * ==========================================================
 *
 * Backend endpoint:
 * POST /dataset/predict-batch/{datasetId}
 *
 * Uploads a transaction CSV, runs every row through the dataset's
 * trained XGBoost model, and persists each analyzed transaction so
 * it also shows up on the Transactions page.
 */
export async function predictTransactionsBatch(
  datasetId: string,
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<BatchPredictionResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<RawBatchPredictionResponse>(
      `/dataset/predict-batch/${datasetId}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (!onUploadProgress || !event.total) return;
          onUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      }
    );

    return response.data.result;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
