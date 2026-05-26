import { elapsedSecondsSince, formatDurationSeconds } from "@/lib/format-duration";
import type { RunJobStats, TranscriptApiIngestionRun } from "@/types/transcript-api-ingestion";

export interface ThroughputMetrics {
  elapsedSeconds: number;
  elapsedLabel: string;
  jobsPerMinute: number | null;
  etaSeconds: number | null;
  etaLabel: string | null;
}

export function computeThroughput(run: TranscriptApiIngestionRun): ThroughputMetrics {
  const elapsedSeconds =
    run.duration_seconds ??
    elapsedSecondsSince(run.started_at);
  const elapsedLabel = formatDurationSeconds(elapsedSeconds);

  const processed = run.run_stats.processed;
  const remaining =
    run.run_stats.queued + run.run_stats.processing;

  if (elapsedSeconds <= 0 || processed <= 0) {
    return {
      elapsedSeconds,
      elapsedLabel,
      jobsPerMinute: null,
      etaSeconds: null,
      etaLabel: null,
    };
  }

  const jobsPerMinute = (processed / elapsedSeconds) * 60;
  let etaSeconds: number | null = null;
  let etaLabel: string | null = null;
  if (remaining > 0 && jobsPerMinute > 0) {
    etaSeconds = Math.ceil((remaining / jobsPerMinute) * 60);
    etaLabel = formatDurationSeconds(etaSeconds);
  }

  return {
    elapsedSeconds,
    elapsedLabel,
    jobsPerMinute: Math.round(jobsPerMinute * 10) / 10,
    etaSeconds,
    etaLabel,
  };
}

export function runProgressPercent(stats: RunJobStats): number {
  return Math.min(100, Math.max(0, stats.progress_pct));
}
