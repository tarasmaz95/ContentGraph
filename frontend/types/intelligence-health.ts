export type HealthLevel = "healthy" | "partial" | "degraded" | "critical";
export type SeverityLevel = "info" | "warning" | "critical";
export type FreshnessSeverity = "green" | "amber" | "red";

export interface IntelligenceOverview {
  total_videos: number;
  videos_with_transcripts: number;
  transcript_coverage_pct: number;
  videos_with_comments: number;
  comment_coverage_pct: number;
  videos_with_title_embeddings: number;
  videos_with_transcript_embeddings: number;
  embedding_coverage_pct: number;
  creators_tracked: number;
  hook_patterns_indexed: number;
  snapshot_days: number;
  latest_snapshot_date: string | null;
  last_catalog_sync_at: string | null;
  last_comment_ingest_at: string | null;
  last_transcript_activity_at: string | null;
  last_transcript_activity_note: string;
}

export interface FreshnessMetric {
  label: string;
  value: number;
  severity: FreshnessSeverity;
  hint?: string | null;
}

export interface CreatorCoverageRow {
  creator_name: string;
  video_count: number;
  transcript_pct: number;
  comment_pct: number;
  embedding_pct: number;
  latest_video_published_at: string | null;
  is_strongest_coverage: boolean;
  is_weakest_coverage: boolean;
}

export interface TranscriptSourceCount {
  source: "extension" | "batch" | "manual" | "unknown";
  count: number;
}

export interface HealthWarning {
  id: string;
  severity: SeverityLevel;
  message: string;
  detail?: string | null;
}

export interface SnapshotRunRow {
  id: number;
  started_at: string;
  finished_at?: string | null;
  status: string;
  creators_saved: number;
  videos_saved: number;
  duration_ms?: number | null;
  error_message?: string | null;
  source: string;
}

export interface IntelligenceHealthResponse {
  generated_at: string;
  system_status: {
    level: HealthLevel;
    headline: string;
    summary: string;
  };
  overview: IntelligenceOverview;
  freshness: { metrics: FreshnessMetric[] };
  creator_coverage: {
    rows: CreatorCoverageRow[];
    strongest_creator: string | null;
    weakest_creator: string | null;
  };
  transcripts: {
    total_transcripts: number;
    avg_transcript_length: number;
    transcripts_missing_embeddings: number;
    orphan_transcript_embeddings: number;
    videos_missing_transcript: number;
    source_breakdown: TranscriptSourceCount[];
    source_tracking_note: string;
  };
  comments: {
    total_comments: number;
    videos_with_comments: number;
    avg_comments_per_video: number;
    videos_with_emotional_tags: number;
    emotional_tags_coverage_pct: number;
    neutral_only_pct: number;
    top_video_comment_share_pct: number;
    top_synced_creators: { creator_name: string; comment_count: number }[];
  };
  snapshots: {
    scheduler_enabled: boolean;
    next_scheduled_at: string | null;
    recent_runs: SnapshotRunRow[];
    videos_with_changing_snapshots: number;
    snapshot_days: number;
  };
  warnings: HealthWarning[];
}
