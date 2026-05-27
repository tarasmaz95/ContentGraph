/** Browser automation ingestion (local worker + Chrome extension). */

export type BrowserIngestionJobStatus =
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "skipped";

export type BrowserIngestionRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type BrowserIngestionMode = "transcript" | "comments" | "both";

export type BrowserJobStatusFilter = "all" | BrowserIngestionJobStatus;

export type FailureCategory =
  | "youtube_blocked"
  | "transcript_unavailable"
  | "comments_disabled"
  | "extension_error"
  | "browser_crash"
  | "timeout"
  | "unknown";

export type TranscriptOutcome = "ok" | "unavailable" | "failed" | "skipped";
export type CommentsOutcome = "ok" | "disabled" | "empty" | "failed" | "skipped";

export type WorkerHealthStatus =
  | "healthy"
  | "offline"
  | "incompatible_extension"
  | "daily_limit"
  | "cooldown"
  | "restart_recommended"
  | "unknown";

export interface BrowserIngestionRunStats {
  jobs_total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
  skipped: number;
  processed: number;
  progress_pct: number;
  success_pct: number;
}

export interface BrowserIngestionJob {
  id: number;
  run_id: number;
  video_id: number;
  video_url: string;
  title: string;
  creator_name: string;
  mode: string;
  status: BrowserIngestionJobStatus;
  retry_count: number;
  error_message: string | null;
  transcript_status: string | null;
  comments_status: string | null;
  transcript_outcome: TranscriptOutcome | null;
  comments_outcome: CommentsOutcome | null;
  sheets_status: string | null;
  embedding_status: string | null;
  failure_category: FailureCategory | string | null;
  duration_seconds: number | null;
  worker_name: string | null;
  screenshot_path: string | null;
  current_phase: string | null;
  retry_history: string[];
  updated_at: string;
  finished_at: string | null;
}

export interface BrowserIngestionJobsPage {
  items: BrowserIngestionJob[];
  total: number;
  offset: number;
  limit: number;
  status_filter: string | null;
}

export interface BrowserIngestionWorker {
  id: number;
  name: string;
  status: string;
  current_action: string;
  current_phase: string | null;
  current_job_id: number | null;
  current_video_url: string | null;
  last_heartbeat_at: string | null;
  processed_today: number;
  success_today: number;
  failed_today: number;
  jobs_per_min: number | null;
  consecutive_failures: number;
  max_jobs_per_day: number | null;
  daily_limit_reached: boolean;
  cooldown_until: string | null;
  extension_version: string | null;
  required_extension_version: string | null;
  memory_mb: number | null;
  uptime_seconds: number | null;
  last_screenshot_path: string | null;
  last_success_at: string | null;
  restart_recommended: boolean;
  processed_per_hour: number | null;
  health_status: WorkerHealthStatus;
  jobs_in_run_success?: number;
  jobs_in_run_failed?: number;
  jobs_in_run_processing?: number;
}

export interface BrowserIngestionRun {
  id: number;
  status: BrowserIngestionRunStatus;
  mode: BrowserIngestionMode;
  limit_count: number | null;
  creator_filter: string | null;
  latest_only: boolean;
  only_missing: boolean;
  jobs_total: number;
  message: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  run_stats: BrowserIngestionRunStats;
  jobs: BrowserIngestionJob[];
}

export interface BrowserIngestionDashboard {
  worker: BrowserIngestionWorker | null;
  workers?: BrowserIngestionWorker[];
  active_run_id: number | null;
  run: BrowserIngestionRun | null;
  catalog_videos_total: number;
  catalog_missing_transcript: number;
  catalog_missing_comments: number;
}

export interface BrowserIngestionStartRequest {
  limit: number;
  mode: BrowserIngestionMode;
  creator_filter?: string | null;
  latest_only: boolean;
  only_missing: boolean;
}

export interface BrowserIngestionStartResponse {
  run: BrowserIngestionRun;
  message: string;
}

export function isBrowserIngestionRunActive(
  run: BrowserIngestionRun | null | undefined,
): boolean {
  if (!run) return false;
  return run.status === "queued" || run.status === "running" || run.status === "paused";
}

export function isBrowserIngestionRunTerminal(
  run: BrowserIngestionRun | null | undefined,
): boolean {
  if (!run) return false;
  return run.status === "completed" || run.status === "failed";
}

export function isWorkerConnected(worker: BrowserIngestionWorker | null | undefined): boolean {
  if (!worker) return false;
  return worker.status !== "offline";
}

export function isWorkerHealthy(worker: BrowserIngestionWorker | null | undefined): boolean {
  if (!worker) return false;
  const dailyCapped =
    worker.max_jobs_per_day != null &&
    worker.max_jobs_per_day > 0 &&
    (worker.health_status === "daily_limit" || worker.daily_limit_reached);
  if (dailyCapped) return false;
  return worker.health_status === "healthy" || worker.status === "online";
}
