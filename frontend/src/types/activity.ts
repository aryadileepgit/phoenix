/**
 * Mirrors backend/app/api/routes/activity.py:get_recent_activity().
 * Derived feed (dataset uploads, model runs, scored batches);
 * the activity_logs table is never written, so user/status
 * fields do not exist and are not invented here.
 */
export type ActivityEventType =
  | "dataset_upload"
  | "model_trained"
  | "batch_analyzed";

export interface ActivityEvent {
  type: ActivityEventType;
  title: string;
  detail: string | null;
  timestamp: string;
}

export interface ActivityFilters {
  type?: string;
  search?: string;
}
