export type SyncRunStatus = "queued" | "running" | "completed" | "failed";
export type SyncRunMode = "quick" | "full";

export type SyncRunStage =
  | "queued"
  | "reading_sheet"
  | "saving_videos"
  | "analyzing_titles"
  | "processing_transcripts"
  | "finding_hook_patterns"
  | "syncing_comments"
  | "finalizing";

export interface SyncRunWarning {
  code: string;
  detail: string;
}

export interface LastSyncStatus {
  run_id: number;
  mode: SyncRunMode;
  finished_at: string;
  duration_seconds: number | null;
  /** Unique videos in DB (matches dashboard catalog). */
  catalog_video_count: number;
  /** Rows read from Google Sheets (may exceed catalog due to duplicates). */
  sheet_rows: number;
  warning_count: number;
}

export interface SyncRunResult {
  mode?: SyncRunMode;
  total_rows?: number;
  created?: number;
  updated?: number;
  titles_analyzed?: number;
  transcripts_processed?: number;
  transcript_text_from_sheet?: number;
  hook_patterns_found?: number;
  audience_discussions_added?: number;
  warning_count?: number;
  warnings?: SyncRunWarning[];
  duration_seconds?: number;
  embeddings_created?: number;
  transcripts_fetched?: number;
  comments_fetched?: number;
  hooks_indexed?: number;
  catalog_video_count?: number;
  sheet_rows?: number;
}

export interface SyncRun {
  id: number;
  mode: SyncRunMode;
  status: SyncRunStatus;
  stage: string;
  processed: number;
  total: number | null;
  message: string | null;
  current_entity_name: string | null;
  warning_count: number;
  warnings: SyncRunWarning[];
  result: SyncRunResult | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
}

export interface SyncRunStartResponse {
  run_id: number;
  status: SyncRunStatus;
  mode: SyncRunMode;
}

export function isSyncRunActive(run: SyncRun | null): boolean {
  return run?.status === "queued" || run?.status === "running";
}

export function syncRunProgressPercent(run: SyncRun): number | null {
  if (run.total == null || run.total <= 0) return null;
  return Math.min(100, Math.round((run.processed / run.total) * 100));
}
