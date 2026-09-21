import { apiClient, extractErrorMessage } from "./datasetService";
import type { SchemaRegistryData, SchemaMapping } from "../types/schema";

/**
 * Backend: GET /schema/registry (flat response).
 */
export async function getSchemaRegistry(): Promise<SchemaRegistryData> {
  try {
    const response =
      await apiClient.get<SchemaRegistryData>("/schema/registry");
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function approveMapping(
  mappingId: string
): Promise<SchemaMapping> {
  try {
    const response = await apiClient.post<{
      message: string;
      mapping: SchemaMapping;
    }>(`/schema/mappings/${encodeURIComponent(mappingId)}/approve`);
    return response.data.mapping;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function rejectMapping(
  mappingId: string
): Promise<SchemaMapping> {
  try {
    const response = await apiClient.post<{
      message: string;
      mapping: SchemaMapping;
    }>(`/schema/mappings/${encodeURIComponent(mappingId)}/reject`);
    return response.data.mapping;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export interface GeminiMapResult {
  message: string;
  saved: number;
  skipped: number;
}

/**
 * AI field mapping. Backend: POST /schema/map-with-gemini {fields}.
 * Returns 503 with a clear message when GEMINI_API_KEY is missing.
 */
export async function mapWithGemini(
  fields: string[]
): Promise<GeminiMapResult> {
  try {
    const response = await apiClient.post<GeminiMapResult>(
      "/schema/map-with-gemini",
      { fields }
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
