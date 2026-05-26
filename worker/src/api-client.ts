import { config } from "./config.js";
import type { FailureCategory } from "./failure-taxonomy.js";

export interface Job {
  id: number;
  run_id: number;
  video_id: number;
  video_url: string;
  title: string;
  creator_name: string;
  mode: string;
  status: string;
}

export interface JobResult {
  transcript_status?: string;
  comments_status?: string;
  sheets_transcript?: string;
  sheets_comments?: string;
  embedding_created?: boolean;
  screenshot_path?: string;
  failure_category?: FailureCategory;
  duration_ms?: number;
  current_phase?: string;
  retry_history?: string[];
  logs: string[];
}

export interface HeartbeatPayload {
  status: string;
  current_action: string;
  current_phase?: string;
  current_job_id?: number | null;
  current_video_url?: string | null;
  processed_today: number;
  success_today: number;
  failed_today: number;
  jobs_per_min?: number;
  consecutive_failures?: number;
  max_jobs_per_day?: number;
  daily_limit_reached?: boolean;
  cooldown_until?: string | null;
  extension_version?: string;
  required_extension_version?: string;
  memory_mb?: number;
  uptime_seconds?: number;
  last_screenshot_path?: string | null;
  last_success_at?: string | null;
  restart_recommended?: boolean;
  processed_per_hour?: number;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.workerToken}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (res.status === 204) {
    return null as T;
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export interface HeartbeatResponse {
  clear_local_cooldown?: boolean;
}

export async function heartbeat(payload: HeartbeatPayload): Promise<HeartbeatResponse> {
  return api<HeartbeatResponse>("/browser-ingestion/workers/heartbeat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function claimJob(): Promise<{
  job: Job | null;
  run_paused?: boolean;
}> {
  return api("/browser-ingestion/jobs/claim", { method: "POST", body: "{}" });
}

export async function completeJob(jobId: number, result: JobResult): Promise<void> {
  await api(`/browser-ingestion/jobs/${jobId}/complete`, {
    method: "POST",
    body: JSON.stringify({ result }),
  });
}

export async function failJob(
  jobId: number,
  errorMessage: string,
  result: JobResult,
  retryable: boolean,
): Promise<void> {
  await api(`/browser-ingestion/jobs/${jobId}/fail`, {
    method: "POST",
    body: JSON.stringify({
      error_message: errorMessage,
      result,
      retryable,
    }),
  });
}

export async function releaseJob(jobId: number, reason: string): Promise<void> {
  await failJob(
    jobId,
    reason,
    { logs: [reason], failure_category: "timeout" },
    true,
  );
}
