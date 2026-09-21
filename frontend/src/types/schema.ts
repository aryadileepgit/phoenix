/**
 * Mirrors backend/app/api/routes/schema.py.
 * method "auto" covers registry/heuristic/legacy origins.
 */
export interface SchemaMapping {
  id: string;
  incomingField: string;
  canonicalField: string;
  method: "auto" | "gemini" | "manual" | "heuristic";
  confidence: number;
  approved: boolean;
  approvalStatus: string;
  createdAt: string | null;
}

export interface CanonicalField {
  name: string;
  description: string;
}

export interface SchemaRegistryData {
  engineStatus: "online" | "offline";
  geminiConfigured: boolean;
  minConfidence: number;
  mappings: SchemaMapping[];
  canonicalFields: CanonicalField[];
  version: {
    version: string;
    status: string;
    fields: number;
    timestamp: string | null;
  };
  stats: {
    total: number;
    gemini: number;
    registry: number;
    pending: number;
  };
}
