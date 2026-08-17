import axios, {
  type AxiosError,
  type AxiosProgressEvent,
} from "axios";

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
 * Base URL for the FastAPI backend.
 *
 * Override using VITE_API_BASE_URL in a .env file.
 * Defaults to the local FastAPI backend.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/**
 * Axios client used for all API requests.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/**
 * Standard API error response structure.
 */
interface StructuredErrorDetail {
  message?: string;
  missing_fields?: string[];
  missing_features?: string[];
  values?: string[];
  value?: string;
}

interface ApiErrorPayload {
  detail?: string | StructuredErrorDetail;
  message?: string;
}

/** Flattens a structured FastAPI `detail` object into one readable line. */
function formatStructuredDetail(detail: StructuredErrorDetail): string {
  const parts = [detail.message ?? "Request failed."];

  const list = detail.missing_fields ?? detail.missing_features ?? detail.values;
  if (list && list.length > 0) {
    parts.push(`(${list.join(", ")})`);
  } else if (detail.value) {
    parts.push(`(${detail.value})`);
  }

  return parts.join(" ");
}

/**
 * Extracts a readable error message from an Axios/API error.
 */
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<ApiErrorPayload>;

    if (axiosErr.response) {
      const payload = axiosErr.response.data;

      if (payload?.detail) {
        return typeof payload.detail === "string"
          ? payload.detail
          : formatStructuredDetail(payload.detail);
      }

      if (payload?.message) {
        return payload.message;
      }

      return `Server responded with status ${axiosErr.response.status}.`;
    }

    if (axiosErr.request) {
      return (
        "No response from server. Is the backend running at " +
        API_BASE_URL +
        "?"
      );
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Request failed due to an unexpected error.";
}

/**
 * Adapts the raw validate_dataset() response
 * into the application's normalized ValidationReport.
 */
function normalizeValidation(
  raw?: RawValidationPayload
): ValidationReport {
  if (!raw) {
    return {};
  }

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
 * Adapts the raw dataset object returned by the backend
 * into the application's normalized DatasetInfo object.
 */
function normalizeDataset(
  raw: RawDataset,
  fileSizeBytes: number
): DatasetInfo {
  const filename = raw.filename;

  return {
    id: raw.id,

    datasetName: filename
      ? filename.replace(/\.csv$/i, "")
      : undefined,

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
 * ==========================================================
 * DATASET UPLOAD
 * ==========================================================
 *
 * Uploads a CSV dataset to the backend.
 *
 * Backend endpoint:
 * POST /dataset/upload
 *
 * Reports upload progress from 0 to 100.
 */
export async function uploadDataset(
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<DatasetUploadResponse> {
  const formData = new FormData();

  formData.append("file", file);

  try {
    const response =
      await apiClient.post<RawDatasetUploadResponse>(
        "/dataset/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },

          onUploadProgress: (
            progressEvent: AxiosProgressEvent
          ) => {
            if (
              !onUploadProgress ||
              !progressEvent.total
            ) {
              return;
            }

            const percent = Math.round(
              (progressEvent.loaded * 100) /
                progressEvent.total
            );

            onUploadProgress(percent);
          },
        }
      );

    return {
      dataset: normalizeDataset(
        response.data.dataset,
        file.size
      ),

      preview: response.data.preview ?? [],
    };
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * CLEAN DATASET
 * ==========================================================
 *
 * Cleans a previously uploaded dataset.
 *
 * Backend endpoint:
 * POST /dataset/clean/{datasetId}
 */
export async function cleanDataset(
  datasetId: string
): Promise<CleanDatasetResponse> {
  try {
    const response =
      await apiClient.post<CleanDatasetResponse>(
        `/dataset/clean/${datasetId}`
      );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * PREPROCESS DATASET
 * ==========================================================
 *
 * Encodes categorical columns and scales
 * numerical columns.
 *
 * Backend endpoint:
 * POST /dataset/preprocess/{datasetId}
 */
export async function preprocessDataset(
  datasetId: string
): Promise<PreprocessDatasetResponse> {
  try {
    const response =
      await apiClient.post<PreprocessDatasetResponse>(
        `/dataset/preprocess/${datasetId}`
      );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * APPLY SMOTE
 * ==========================================================
 *
 * Applies SMOTE to balance the minority
 * fraud class.
 *
 * Backend endpoint:
 * POST /dataset/smote/{datasetId}
 */
export async function applySmote(
  datasetId: string
): Promise<SmoteResponse> {
  try {
    const response =
      await apiClient.post<SmoteResponse>(
        `/dataset/smote/${datasetId}`
      );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * FEATURE ENGINEERING
 * ==========================================================
 *
 * Generates derived/engineered features
 * on the balanced dataset.
 *
 * Backend endpoint:
 * POST /dataset/feature-engineering/{datasetId}
 */
export async function generateFeatures(
  datasetId: string
): Promise<FeatureEngineeringResponse> {
  try {
    const response =
      await apiClient.post<FeatureEngineeringResponse>(
        `/dataset/feature-engineering/${datasetId}`
      );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * TRAIN / TEST SPLIT
 * ==========================================================
 *
 * Splits the engineered dataset into
 * training and testing datasets.
 *
 * Backend endpoint:
 * POST /dataset/train-test-split/{datasetId}
 */
export async function splitTrainTest(
  datasetId: string
): Promise<TrainTestSplitResponse> {
  try {
    const response =
      await apiClient.post<TrainTestSplitResponse>(
        `/dataset/train-test-split/${datasetId}`
      );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * COMPLETE DATASET PIPELINE
 * ==========================================================
 *
 * Runs the complete Phoenix fraud detection
 * pipeline for one dataset.
 *
 * Pipeline:
 *
 * 1. Cleaning
 * 2. Preprocessing
 * 3. SMOTE
 * 4. Feature Engineering
 * 5. Train/Test Split
 * 6. XGBoost Training
 *
 * Backend endpoint:
 * POST /dataset/pipeline/{datasetId}
 */
export async function runDatasetPipeline(
  datasetId: string
) {
  try {
    const response = await apiClient.post(
      `/dataset/pipeline/${datasetId}`
    );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * DATASET HISTORY
 * ==========================================================
 *
 * Gets previously uploaded datasets.
 *
 * Backend endpoint:
 * GET /dataset/history
 *
 * NOTE:
 * This currently expects the backend response
 * to directly be DatasetHistoryItem[].
 */
export async function getDatasetHistory(): Promise<
  DatasetHistoryItem[]
> {
  try {
    const response =
      await apiClient.get<DatasetHistoryItem[]>(
        "/dataset/history"
      );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}

/**
 * ==========================================================
 * GET DATASET BY ID
 * ==========================================================
 *
 * Fetches complete information about
 * one previously uploaded dataset.
 *
 * Backend endpoint:
 * GET /dataset/{datasetId}
 */
export async function getDatasetById(
  datasetId: string
): Promise<DatasetInfo> {
  try {
    const response =
      await apiClient.get<DatasetInfo>(
        `/dataset/${datasetId}`
      );

    return response.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err)
    );
  }
}