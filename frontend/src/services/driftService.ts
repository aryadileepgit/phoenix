import { apiClient, extractErrorMessage } from "./datasetService";
import type { DriftStatusResponse, DriftRunResult } from "../types/drift";

/**
 * Backend: GET /drift/status — latest persisted run (or a
 * never-run shape) plus a live feature snapshot and events.
 */
export async function getDriftStatus(): Promise<DriftStatusResponse> {
  try {
    const response =
      await apiClient.get<DriftStatusResponse>("/drift/status");
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Backend: POST /drift/run — KS tests on scored rows, persists
 * DriftEvent + DriftWindow. Returns 400 when fewer than 4
 * scored transactions exist.
 */
export async function runDriftDetection(): Promise<DriftRunResult> {
  try {
    const response =
      await apiClient.post<DriftRunResult>("/drift/run");
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
