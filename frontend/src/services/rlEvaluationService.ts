import { apiClient, extractErrorMessage } from "./datasetService";

export interface RLEvaluationRun {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  total_batches: number;
  batch_size: number;
  dataset_id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateRunRequest {
  name: string;
  dataset_id: string;
  total_batches: number;
  batch_size: number;
  baseline_model_id?: string;
}

export interface CreateRunResponse {
  run_id: string;
  name: string;
  status: string;
  total_batches: number;
  message: string;
}

export async function getRLEvaluationRuns(
  limit = 50,
  offset = 0
): Promise<any[]> {
  try {
    const response = await apiClient.get(
      `/rl-evaluation/runs?limit=${limit}&offset=${offset}`
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function createRLEvaluationRun(
  request: CreateRunRequest
): Promise<CreateRunResponse> {
  try {
    const response = await apiClient.post<CreateRunResponse>(
      "/rl-evaluation/runs",
      request
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function getRLEvaluationRun(runId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/rl-evaluation/runs/${runId}`);
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function getRLEvaluationBatches(
  runId: string,
  limit = 100,
  offset = 0
): Promise<any[]> {
  try {
    const response = await apiClient.get(
      `/rl-evaluation/runs/${runId}/batches?limit=${limit}&offset=${offset}`
    );
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function getRLEvaluationChart(runId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/rl-evaluation/runs/${runId}/chart`);
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function getRLEvaluationSummary(runId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/rl-evaluation/runs/${runId}/summary`);
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}