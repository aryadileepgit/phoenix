import { apiClient, extractErrorMessage } from "./datasetService";
import type { ActivityEvent } from "../types/activity";

/**
 * Derived system activity feed.
 * Backend: GET /activity?limit=
 * Returns { message, activity: [{ type, title, detail, timestamp }] }.
 */
export async function getActivity(
  limit = 50
): Promise<ActivityEvent[]> {
  try {
    const response = await apiClient.get<{
      message: string;
      activity: ActivityEvent[];
    }>("/activity", { params: { limit } });
    return response.data.activity ?? [];
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
