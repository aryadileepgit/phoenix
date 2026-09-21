import { apiClient } from "./datasetService";
import type {
  DatasetOverviewData,
  PipelineStage,
  DatasetStatistics,
  TrainedModelInfo,
} from "../types/datasetOverview";

/**
 * Backend source of truth:
 * - GET /dataset/overview returns a flat DatasetOverviewData object
 *   (datasetId, name, rows, ...), NOT a { data } wrapper.
 * - GET /dataset/pipeline-stages returns { datasetId, stages }.
 * - GET /dataset/statistics returns a flat DatasetStatistics object.
 */
export async function getDatasetOverview(): Promise<DatasetOverviewData> {
  try {
    const response = await apiClient.get<DatasetOverviewData>("/dataset/overview");
    return response.data;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to load dataset overview.");
  }
}

export async function getPipelineStages(): Promise<PipelineStage[]> {
  try {
    const response = await apiClient.get<{ datasetId: string; stages: PipelineStage[] }>(
      "/dataset/pipeline-stages"
    );
    return response.data.stages ?? [];
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to load pipeline stages.");
  }
}

export async function getDatasetStatistics(): Promise<DatasetStatistics> {
  try {
    const response = await apiClient.get<DatasetStatistics>("/dataset/statistics");
    return response.data;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to load dataset statistics.");
  }
}

export async function runCleaning(datasetId: string): Promise<void> {
  await apiClient.post(`/dataset/clean/${datasetId}`);
}

export async function runFeatureEngineering(datasetId: string): Promise<void> {
  await apiClient.post(`/dataset/feature-engineering/${datasetId}`);
}

export async function runPreprocessing(datasetId: string): Promise<void> {
  await apiClient.post(`/dataset/preprocess/${datasetId}`);
}

export async function runBalanceDataset(datasetId: string): Promise<void> {
  await apiClient.post(`/dataset/smote/${datasetId}`);
}

/**
 * Existing trained model, from the saved model metadata surfaced
 * by GET /dataset/latest. The Dataset page is read-only for the
 * model: it never trains or retrains.
 */
export async function getTrainedModel(): Promise<TrainedModelInfo | null> {
  try {
    const response = await apiClient.get<{
      message: string;
      result: { model: TrainedModelInfo | null };
    }>("/dataset/latest");
    return response.data.result?.model ?? null;
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : "Failed to load trained model information."
    );
  }
}