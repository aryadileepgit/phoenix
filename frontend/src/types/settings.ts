/**
 * Mirrors backend/app/api/routes/settings.py.
 * modelVersion is read-only (trained artifact name);
 * geminiConfigured is a presence flag, never a key.
 */
export interface ModelThresholds {
  fraudThreshold: number;
  verificationThreshold: number;
}

export interface SchemaSettings {
  minConfidence: number;
}

export interface DriftSettings {
  driftKsThreshold: number;
  driftFraudRateThreshold: number;
}

export interface SettingsData {
  model: {
    modelVersion: string;
    fraudThreshold: number;
    verificationThreshold: number;
  };
  schemaEvolution: {
    geminiConfigured: boolean;
    minConfidence: number;
  };
  driftDetection: {
    driftKsThreshold: number;
    driftFraudRateThreshold: number;
  };
  system: {
    api_status: string;
    database_status: string;
    model_artifact: string;
  };
}
