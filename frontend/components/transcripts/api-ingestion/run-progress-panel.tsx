"use client";

import { CheckCircle2, Clock, Gauge, XCircle } from "lucide-react";

import { RunStatusBadge } from "@/components/transcripts/api-ingestion/run-status-badge";
import { useT } from "@/lib/i18n";
import { computeThroughput, runProgressPercent } from "@/lib/transcript-api-ingestion-metrics";
import { cn } from "@/lib/utils";
import type { TranscriptApiIngestionRun } from "@/types/transcript-api-ingestion";
import { isApiIngestionRunActive, isApiIngestionRunTerminal } from "@/types/transcript-api-ingestion";

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

export function RunProgressPanel({
  run,
  sticky = false,
}: {
  run: TranscriptApiIngestionRun;
  sticky?: boolean;
}) {
  const t = useT();
  const stats = run.run_stats;
  const percent = runProgressPercent(stats);
  const throughput = computeThroughput(run);
  const active = isApiIngestionRunActive(run);
  const terminal = isApiIngestionRunTerminal(run);

  return (
    <section
      className={cn(
        "space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm",
        sticky && "sticky top-14 z-10 backdrop-blur supports-[backdrop-filter]:bg-card/95",
        terminal && run.status === "completed" && "border-emerald-500/30 bg-emerald-500/5",
        terminal && run.status === "failed" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("transcriptApiIngestion.runSection")}
        </h2>
        <RunStatusBadge status={run.status} runId={run.id} />
      </div>

      {run.message && (
        <p className="text-sm text-muted-foreground">{run.message}</p>
      )}

      {terminal && run.status === "completed" && (
        <div className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("transcriptApiIngestion.runCompleted")}</span>
        </div>
      )}
      {terminal && run.status === "failed" && run.error_message && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{run.error_message}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {t("transcriptApiIngestion.progressLabel", {
              processed: String(stats.processed),
              total: String(stats.jobs_total),
            })}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              active ? "bg-primary" : terminal ? "bg-emerald-600" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span>{t("transcriptApiIngestion.statsQueued")}: {stats.queued}</span>
          <span>{t("transcriptApiIngestion.statsProcessing")}: {stats.processing}</span>
          <span>{t("transcriptApiIngestion.statsSuccess")}: {stats.success}</span>
          <span>{t("transcriptApiIngestion.statsFailed")}: {stats.failed}</span>
          <span>{t("transcriptApiIngestion.statsUnavailable")}: {stats.unavailable}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricPill
          icon={Gauge}
          label={t("transcriptApiIngestion.runSuccessPct")}
          value={`${stats.success_pct}%`}
        />
        <MetricPill
          icon={Gauge}
          label={t("transcriptApiIngestion.runUnavailablePct")}
          value={`${stats.unavailable_pct}%`}
        />
        <MetricPill
          icon={Clock}
          label={t("transcriptApiIngestion.elapsed")}
          value={throughput.elapsedLabel}
          sub={formatUtc(run.started_at)}
        />
        <MetricPill
          icon={Clock}
          label={t("transcriptApiIngestion.throughput")}
          value={
            throughput.jobsPerMinute != null
              ? t("transcriptApiIngestion.jobsPerMin", {
                  rate: String(throughput.jobsPerMinute),
                })
              : "—"
          }
          sub={
            throughput.etaLabel
              ? t("transcriptApiIngestion.eta", { time: throughput.etaLabel })
              : active
                ? t("transcriptApiIngestion.etaUnknown")
                : undefined
          }
        />
      </div>
    </section>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
