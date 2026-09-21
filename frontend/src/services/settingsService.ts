import { apiClient, extractErrorMessage } from "./datasetService";
import type {
  SettingsData,
  ModelThresholds,
  SchemaSettings,
  DriftSettings,
} from "../types/settings";

/**
 * Backend: GET /settings — live thresholds, Gemini presence
 * flag (never the key), and system probes.
 */
export async function getSettings(): Promise<SettingsData> {
  try {
    const response = await apiClient.get<SettingsData>("/settings");
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Backend: PUT /settings/model — persists validated thresholds
 * that the scorer actually reads. 422 on invalid ranges.
 */
export async function updateModelSettings(
  settings: ModelThresholds
): Promise<void> {
  try {
    await apiClient.put("/settings/model", {
      fraud_threshold: settings.fraudThreshold,
      verification_threshold: settings.verificationThreshold,
    });
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Backend: PUT /settings/schema-evolution — persists the
 * minimum Gemini mapping confidence actually enforced.
 */
export async function updateSchemaEvolutionSettings(
  settings: SchemaSettings
): Promise<void> {
  try {
    await apiClient.put("/settings/schema-evolution", {
      min_confidence: settings.minConfidence,
    });
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Backend: PUT /settings/drift-detection — persists the KS and
 * fraud-rate thresholds used by drift runs.
 */
export async function updateDriftDetectionSettings(
  settings: DriftSettings
): Promise<void> {
  try {
    await apiClient.put("/settings/drift-detection", {
      drift_ks_threshold: settings.driftKsThreshold,
      drift_fraud_rate_threshold:
        settings.driftFraudRateThreshold,
    });
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
