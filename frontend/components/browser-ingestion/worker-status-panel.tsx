"use client";

import { AlertTriangle, Laptop, Wifi, WifiOff } from "lucide-react";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BrowserIngestionWorker } from "@/types/browser-ingestion";
import { isWorkerConnected } from "@/types/browser-ingestion";

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function healthBadgeClass(health: string): string {
  switch (health) {
    case "healthy":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "daily_limit":
    case "cooldown":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
    case "incompatible_extension":
    case "restart_recommended":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function WorkerStatusPanel({ worker }: { worker: BrowserIngestionWorker | null }) {
  const t = useT();
  const connected = isWorkerConnected(worker);

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("browserIngestion.workerSection")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              connected
                ? "bg-green-500/15 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected
              ? t("browserIngestion.workerOnline")
              : t("browserIngestion.workerOffline")}
          </span>
          {worker && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                healthBadgeClass(worker.health_status),
              )}
            >
              {t(`browserIngestion.health.${worker.health_status}`)}
            </span>
          )}
        </div>
      </div>

      {!worker ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("browserIngestion.workerNone")}</p>
      ) : (
        <>
          {((worker.max_jobs_per_day != null &&
            worker.max_jobs_per_day > 0 &&
            worker.daily_limit_reached) ||
            worker.health_status === "incompatible_extension" ||
            worker.restart_recommended) && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {worker.max_jobs_per_day != null &&
                  worker.max_jobs_per_day > 0 &&
                  worker.daily_limit_reached && (
                  <p>{t("browserIngestion.dailyLimitReached")}</p>
                )}
                {worker.health_status === "incompatible_extension" && (
                  <p>
                    {t("browserIngestion.extensionIncompatible", {
                      current: worker.extension_version || "?",
                      required: worker.required_extension_version || "?",
                    })}
                  </p>
                )}
                {worker.restart_recommended && (
                  <p>{t("browserIngestion.restartRecommended")}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("browserIngestion.workerName")} value={worker.name} icon={Laptop} />
            <Stat
              label={t("browserIngestion.workerPhase")}
              value={worker.current_phase || worker.current_action || "idle"}
            />
            <Stat
              label={t("browserIngestion.workerMemory")}
              value={worker.memory_mb != null ? `${worker.memory_mb} MB` : "—"}
            />
            <Stat
              label={t("browserIngestion.workerUptime")}
              value={formatUptime(worker.uptime_seconds)}
            />
            <Stat
              label={t("browserIngestion.jobsProcessedToday")}
              value={String(worker.processed_today)}
            />
            <Stat
              label={t("browserIngestion.workerThroughput")}
              value={
                worker.processed_per_hour != null
                  ? t("browserIngestion.perHour", {
                      rate: String(worker.processed_per_hour),
                    })
                  : worker.jobs_per_min != null
                    ? t("browserIngestion.jobsPerMin", {
                        rate: String(worker.jobs_per_min),
                      })
                    : "—"
              }
            />
            <Stat
              label={t("browserIngestion.consecutiveFailures")}
              value={String(worker.consecutive_failures)}
            />
            <Stat
              label={t("browserIngestion.workerToday")}
              value={`${worker.success_today} ok / ${worker.failed_today} fail`}
            />
            {worker.extension_version && (
              <Stat
                label={t("browserIngestion.extensionVersion")}
                value={`${worker.extension_version}${
                  worker.required_extension_version
                    ? ` (≥${worker.required_extension_version})`
                    : ""
                }`}
              />
            )}
            {worker.last_screenshot_path && (
              <p className="sm:col-span-2 lg:col-span-4 truncate text-xs text-muted-foreground">
                {t("browserIngestion.lastScreenshot")}: {worker.last_screenshot_path}
              </p>
            )}
            {worker.current_video_url && (
              <p className="sm:col-span-2 lg:col-span-4 truncate text-xs text-muted-foreground">
                {t("browserIngestion.currentVideo")}: {worker.current_video_url}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Laptop;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
