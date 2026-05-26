/** Snapshot cron monitoring (Settings). */

export interface SnapshotStatus {
  scheduler_enabled: boolean;
  schedule_hour_utc: number;
  schedule_minute_utc: number;
  next_scheduled_at: string | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_status: string | null;
  creators_saved: number | null;
  videos_saved: number | null;
  duration_ms: number | null;
  error_message: string | null;
}

export interface SnapshotRunHistoryItem {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  creators_saved: number;
  videos_saved: number;
  duration_ms: number | null;
  error_message: string | null;
  source: string;
}

export interface SnapshotRunHistoryResponse {
  items: SnapshotRunHistoryItem[];
}

export interface SnapshotRunResult {
  snapshot_date: string;
  creators_saved: number;
  videos_saved: number;
  message: string;
  run_id: number | null;
  duration_ms: number | null;
}
