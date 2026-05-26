/** API-based transcript ingestion queue (server-side, no browser). */

export type TranscriptApiIngestionJobStatus =
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "unavailable"
  | "skipped_existing";

export type TranscriptApiIngestionRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type JobStatusFilter = "all" | TranscriptApiIngestionJobStatus;

export interface CatalogCoverageStats {
  total_videos: number;
  with_transcript: number;
  without_transcript: number;
  with_transcript_embedding: number;
  transcript_coverage_pct: number;
  embedding_coverage_pct: number;
}

export interface RunJobStats {
  jobs_total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
  unavailable: number;
  skipped_existing: number;
  processed: number;
  progress_pct: number;
  success_pct: number;
  unavailable_pct: number;
}

export interface TranscriptApiIngestionDashboardStats {
  catalog: CatalogCoverageStats;
  active_run_id: number | null;
}

export interface TranscriptApiIngestionStartRequest {
  limit: number;
  worker_count: number;
  creator_filter?: string | null;
  latest_only: boolean;
  only_missing: boolean;
}

export interface TranscriptApiIngestionJob {
  id: number;
  run_id: number;
  video_id: number;
  status: TranscriptApiIngestionJobStatus;
  title: string;
  creator_name: string;
  transcript_chars: number;
  embedding_created: boolean;
  sheets_rows_updated: number;
  sheets_writeback: string;
  error_message: string | null;
  updated_at: string;
}

export interface TranscriptApiIngestionJobsPage {
  items: TranscriptApiIngestionJob[];
  total: number;
  offset: number;
  limit: number;
  status_filter: string | null;
}

export interface TranscriptApiIngestionRun {
  id: number;
  status: TranscriptApiIngestionRunStatus;
  worker_count: number;
  limit_count: number | null;
  creator_filter: string | null;
  latest_only: boolean;
  only_missing: boolean;
  jobs_total: number;
  message: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  catalog: CatalogCoverageStats;
  run_stats: RunJobStats;
  jobs: TranscriptApiIngestionJob[];
}

export interface TranscriptApiIngestionStartResponse {
  run: TranscriptApiIngestionRun;
  message: string;
}

export function isApiIngestionRunActive(
  run: TranscriptApiIngestionRun | null | undefined,
): boolean {
  if (!run) return false;
  return run.status === "queued" || run.status === "running" || run.status === "paused";
}

export function isApiIngestionRunTerminal(
  run: TranscriptApiIngestionRun | null | undefined,
): boolean {
  if (!run) return false;
  return run.status === "completed" || run.status === "failed";
}
