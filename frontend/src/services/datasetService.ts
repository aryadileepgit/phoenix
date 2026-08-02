import axios, { type AxiosError, type AxiosProgressEvent } from "axios";
import type {
  DatasetUploadResponse,
  CleanDatasetResponse,
  PreprocessDatasetResponse,
  SmoteResponse,
  FeatureEngineeringResponse,
  TrainTestSplitResponse,
  DatasetHistoryItem,
  DatasetInfo,
  ValidationReport,
  RawDataset,
  RawDatasetUploadResponse,
  RawValidationPayload,
} from "../types/dataset";

/**
 * Base URL for the FastAPI backend. Override via VITE_API_BASE_URL in a
 * .env file for staging/production; defaults to the local dev backend.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

interface ApiErrorPayload {
  detail?: string;
  message?: string;
}

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<ApiErrorPayload>;

    if (axiosErr.response) {
      const payload = axiosErr.response.data;
      if (payload?.detail) return payload.detail;
      if (payload?.message) return payload.message;
      return `Server responded with status ${axiosErr.response.status}.`;
    }

    if (axiosErr.request) {
      return "No response from server. Is the backend running at " + API_BASE_URL + "?";
    }
  }

  if (err instanceof Error) return err.message;
  return "Request failed due to an unexpected error.";
}

/** Adapts the raw validate_dataset() dict into the app's normalized ValidationReport. */
function normalizeValidation(raw?: RawValidationPayload): ValidationReport {
  if (!raw) return {};
  return {
    csvFormatValid: raw.csvFormatValid,
    requiredColumnsPresent: raw.requiredColumnsPresent,
    missingColumns: raw.missingColumns,
    missingValues: raw.missingValues,
    duplicateRows: raw.duplicateRows,
    validationStatus: raw.validationStatus,
  };
}

/**
 * Adapts the raw dataset object into the app's normalized DatasetInfo.
 * The backend returns dataset metadata nested under `dataset`.
 */
function normalizeDataset(raw: RawDataset, fileSizeBytes: number): DatasetInfo {
  const filename = raw.filename;
  return {
    id: raw.id,
    datasetName: filename ? filename.replace(/\.csv$/i, "") : undefined,
    originalFilename: filename,
    rows: raw.rows,
    columns: raw.columns,
    status: raw.status,
    fileSize: fileSizeBytes,
    uploadTime: new Date().toISOString(),
    validation: normalizeValidation(raw.validation),
  };
}

/**
 * Uploads a CSV dataset to the backend for validation, preprocessing, and
 * metadata storage. Reports upload progress (0-100) via onUploadProgress.
 */
export async function uploadDataset(
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<DatasetUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await apiClient.post<RawDatasetUploadResponse>("/dataset/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (!onUploadProgress || !progressEvent.total) return;
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percent);
      },
    });

    return {
      dataset: normalizeDataset(response.data.dataset, file.size),
      preview: [],
    };
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Cleans (deduplicates / fixes missing values in) a previously uploaded dataset. */
export async function cleanDataset(datasetId: string): Promise<CleanDatasetResponse> {
  try {
    const response = await apiClient.post<CleanDatasetResponse>(
      `/dataset/clean/${datasetId}`
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Encodes categorical columns and scales numerical columns. */
export async function preprocessDataset(datasetId: string): Promise<PreprocessDatasetResponse> {
  try {
    const response = await apiClient.post<PreprocessDatasetResponse>(
      `/dataset/preprocess/${datasetId}`
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Applies SMOTE to balance the minority (fraud) class. */
export async function applySmote(datasetId: string): Promise<SmoteResponse> {
  try {
    const response = await apiClient.post<SmoteResponse>(
      `/dataset/smote/${datasetId}`
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Generates derived/engineered features on the balanced dataset. */
export async function generateFeatures(datasetId: string): Promise<FeatureEngineeringResponse> {
  try {
    const response = await apiClient.post<FeatureEngineeringResponse>(
      `/dataset/feature-engineering/${datasetId}`
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Splits the engineered dataset into training and testing sets. */
export async function splitTrainTest(
  datasetId: string
): Promise<TrainTestSplitResponse> {
  try {
    const response = await apiClient.post<TrainTestSplitResponse>(
      `/dataset/train-test-split/${datasetId}`
    );

    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Lists previously uploaded datasets for the history table. */
export async function getDatasetHistory(): Promise<DatasetHistoryItem[]> {
  try {
    const response = await apiClient.get<DatasetHistoryItem[]>("/dataset/history");
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Fetches full details for a previously uploaded dataset (used by Dataset History selection). */
export async function getDatasetById(datasetId: string): Promise<DatasetInfo> {
  try {
    const response = await apiClient.get<DatasetInfo>(`/dataset/${datasetId}`);
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
