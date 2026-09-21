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
 * ==========================================================
 * API BASE URL
 * ==========================================================
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:1992";

/**
 * Axios client
 */

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/**
 * ==========================================================
 * API ERROR TYPES
 * ==========================================================
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

/**
 * Convert structured backend error into readable text.
 */

function formatStructuredDetail(
  detail: StructuredErrorDetail
): string {
  const parts = [
    detail.message ?? "Request failed.",
  ];

  const list =
    detail.missing_fields ??
    detail.missing_features ??
    detail.values;

  if (list && list.length > 0) {
    parts.push(`(${list.join(", ")})`);
  } else if (detail.value) {
    parts.push(`(${detail.value})`);
  }

  return parts.join(" ");
}

/**
 * Extract readable API error.
 */

export function extractErrorMessage(
  err: unknown
): string {

  if (axios.isAxiosError(err)) {

    const axiosErr =
      err as AxiosError<ApiErrorPayload>;

    if (axiosErr.response) {

      const payload =
        axiosErr.response.data;

      if (payload?.detail) {

        return typeof payload.detail === "string"
          ? payload.detail
          : formatStructuredDetail(
              payload.detail
            );
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
 * ==========================================================
 * VALIDATION NORMALIZATION
 * ==========================================================
 */

function normalizeValidation(
  raw?: RawValidationPayload
): ValidationReport {

  if (!raw) {
    return {};
  }

  return {
    total_rows: raw.total_rows,
    total_columns: raw.total_columns,

    csvFormatValid:
      raw.csvFormatValid,

    requiredColumnsPresent:
      raw.requiredColumnsPresent,

    missingColumns:
      raw.missingColumns,

    missingValues:
      raw.missingValues,

    duplicateRows:
      raw.duplicateRows,

    validationStatus:
      raw.validationStatus,
  };
}

/**
 * ==========================================================
 * DATASET NORMALIZATION
 * ==========================================================
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

    uploadTime:
      new Date().toISOString(),

    validation:
      normalizeValidation(
        raw.validation
      ),
  };
}

/**
 * ==========================================================
 * UPLOAD DATASET
 * ==========================================================
 *
 * POST /dataset/upload
 */

export async function uploadDataset(
  file: File,
  onUploadProgress?: (
    percent: number
  ) => void
): Promise<DatasetUploadResponse> {

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  try {

    const response =
      await apiClient.post<RawDatasetUploadResponse>(
        "/dataset/upload",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
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

            const percent =
              Math.round(
                (progressEvent.loaded * 100) /
                  progressEvent.total
              );

            onUploadProgress(percent);
          },
        }
      );

    return {

      dataset:
        normalizeDataset(
          response.data.dataset,
          file.size
        ),

      preview:
        response.data.preview ?? [],
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
 * Runs:
 *
 * 1. Cleaning
 * 2. Preprocessing
 * 3. SMOTE
 * 4. Feature Engineering
 * 5. Train/Test Split
 *
 * This function intentionally calls the existing
 * individual endpoints sequentially.
 *
 * This means the frontend does not depend on a
 * /dataset/pipeline/{id} backend endpoint.
 */

export interface CompletePipelineResult {

  cleaning:
    CleanDatasetResponse;

  preprocessing:
    PreprocessDatasetResponse;

  smote:
    SmoteResponse;

  featureEngineering:
    FeatureEngineeringResponse;

  split:
    TrainTestSplitResponse;
}

export async function runDatasetPipeline(
  datasetId: string
): Promise<CompletePipelineResult> {

  try {

    /**
     * STEP 1
     * Cleaning
     */

    const cleaning =
      await cleanDataset(
        datasetId
      );

    /**
     * STEP 2
     * Preprocessing
     */

    const preprocessing =
      await preprocessDataset(
        datasetId
      );

    /**
     * STEP 3
     * SMOTE
     */

    const smote =
      await applySmote(
        datasetId
      );

    /**
     * STEP 4
     * Feature Engineering
     */

    const featureEngineering =
      await generateFeatures(
        datasetId
      );

    /**
     * STEP 5
     * Train/Test Split
     */

    const split =
      await splitTrainTest(
        datasetId
      );

    return {

      cleaning,

      preprocessing,

      smote,

      featureEngineering,

      split,
    };

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
 * GET /dataset/history
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