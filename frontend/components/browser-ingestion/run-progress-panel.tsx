"use client";

import { AlertTriangle, CheckCircle2, Clock, Gauge, XCircle } from "lucide-react";

import { friendlyHealth, friendlyJobStatus } from "@/lib/browser-ingestion-labels";
import { useT } from "@/lib/i18n";
import {
  browserRunProgressPercent,
  computeBrowserThroughput,
} from "@/lib/browser-ingestion-metrics";
import { cn } from "@/lib/utils";
import type { BrowserIngestionRun, BrowserIngestionWorker } from "@/types/browser-ingestion";
import {
  isBrowserIngestionRunActive,
  isBrowserIngestionRunTerminal,
} from "@/types/browser-ingestion";

export function BrowserRunProgressPanel({
  run,
  worker,
  sticky = false,
}: {
  run: BrowserIngestionRun;
  worker: BrowserIngestionWorker | null;
  sticky?: boolean;
}) {
  const t = useT();
  const stats = run.run_stats;
  const percent = browserRunProgressPercent(stats);
  const throughput = computeBrowserThroughput(run, worker?.jobs_per_min);
  const active = isBrowserIngestionRunActive(run);
  const terminal = isBrowserIngestionRunTerminal(run);
  const blockedWorker =
    active && worker
      ? ["cooldown", "incompatible_extension", "offline"].includes(worker.health_status) ||
        (worker.health_status === "daily_limit" &&
          worker.max_jobs_per_day != null &&
          worker.max_jobs_per_day > 0)
        ? worker
        : null
      : null;

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
          {t("browserIngestion.runSection")}
        </h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {t(`browserIngestion.runStatus.${run.status}`)} · #{run.id}
        </span>
      </div>

      {run.message && <p className="text-sm text-muted-foreground">{run.message}</p>}

      {blockedWorker && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-medium">
              {t("browserIngestion.runWaitingForWorker", {
                status: friendlyHealth(blockedWorker.health_status, t),
              })}
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-100/80">
              {t("browserIngestion.runWaitingForWorkerHint", {
                queued: String(stats.queued),
                failed: String(stats.failed),
                processing: String(stats.processing),
              })}
            </p>
            {blockedWorker.cooldown_until && (
              <p className="text-xs text-amber-800/80 dark:text-amber-100/80">
                {t("browserIngestion.cooldownUntil", {
                  time: formatDateTime(blockedWorker.cooldown_until),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {terminal && run.status === "completed" && (
        <div className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("browserIngestion.runCompleted")}</span>
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
            {t("browserIngestion.progressLabel", {
              processed: String(stats.processed),
              total: String(stats.jobs_total),
            })}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span>
            {friendlyJobStatus("queued", t)}: {stats.queued}
          </span>
          <span>
            {friendlyJobStatus("processing", t)}: {stats.processing}
          </span>
          <span>
            {friendlyJobStatus("success", t)}: {stats.success}
          </span>
          <span>
            {friendlyJobStatus("failed", t)}: {stats.failed}
          </span>
          <span>
            {friendlyJobStatus("skipped", t)}: {stats.skipped}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricPill
          icon={Gauge}
          label={t("browserIngestion.runSuccessPct")}
          value={`${stats.success_pct}%`}
        />
        <MetricPill
          icon={Clock}
          label={t("browserIngestion.elapsed")}
          value={throughput.elapsedLabel}
        />
        <MetricPill
          icon={Clock}
          label={t("browserIngestion.throughput")}
          value={
            throughput.jobsPerMinute != null
              ? t("browserIngestion.jobsPerMin", {
                  rate: String(throughput.jobsPerMinute),
                })
              : "—"
          }
          sub={
            throughput.etaLabel
              ? t("browserIngestion.eta", { time: throughput.etaLabel })
              : active
                ? t("browserIngestion.etaUnknown")
                : undefined
          }
        />
      </div>
    </section>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
