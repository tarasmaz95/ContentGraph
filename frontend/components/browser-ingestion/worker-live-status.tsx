"use client";

import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Laptop, MemoryStick, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BrowserIngestionWorker } from "@/types/browser-ingestion";
import { isWorkerConnected, isWorkerHealthy } from "@/types/browser-ingestion";
import {
  friendlyHealth,
  friendlyPhase,
  isWorkerProcessing,
} from "@/lib/browser-ingestion-labels";

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatLastSuccess(iso: string | null, t: (k: string) => string): string {
  if (!iso) return t("browserIngestion.lastSuccessNone");
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function healthVariant(
  health: string,
): "success" | "warning" | "muted" {
  if (health === "healthy") return "success";
  if (health === "offline" || health === "unknown") return "muted";
  return "warning";
}

export function WorkerLiveStatus({
  worker,
  sticky = true,
  onResetCooldown,
}: {
  worker: BrowserIngestionWorker | null;
  sticky?: boolean;
  onResetCooldown?: () => Promise<void>;
}) {
  const t = useT();
  const [resetting, setResetting] = useState(false);
  const connected = isWorkerConnected(worker);
  const healthy = isWorkerHealthy(worker);
  const processing =
    worker && isWorkerProcessing(worker.current_phase, worker.current_action);

  const dailyPct =
    worker?.max_jobs_per_day && worker.max_jobs_per_day > 0
      ? Math.min(100, (worker.processed_today / worker.max_jobs_per_day) * 100)
      : null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border shadow-md",
        connected && healthy
          ? "border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/5"
          : "border-border bg-card",
        sticky && "sticky top-14 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/95",
      )}
    >
      <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">{t("browserIngestion.liveStatusTitle")}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={connected ? "success" : "muted"}
              className={cn(processing && connected && "ring-2 ring-emerald-500/30")}
            >
              {connected
                ? t("browserIngestion.statusConnected")
                : t("browserIngestion.statusDisconnected")}
            </Badge>
            {worker && (
              <Badge variant={healthVariant(worker.health_status)}>
                {friendlyHealth(worker.health_status, t)}
              </Badge>
            )}
          </div>
        </div>

        {processing && worker && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
            <Activity className="h-4 w-4 animate-pulse text-primary" />
            <span className="text-sm font-medium">
              {friendlyPhase(worker.current_phase || worker.current_action, t)}
            </span>
          </div>
        )}

        {!connected && (
          <p className="mt-2 text-sm text-muted-foreground">{t("browserIngestion.workerNone")}</p>
        )}
      </div>

      {worker && (
        <div className="space-y-4 p-5">
          {(worker.daily_limit_reached ||
            worker.health_status === "incompatible_extension" ||
            worker.health_status === "cooldown" ||
            worker.restart_recommended) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                {worker.daily_limit_reached && <p>{t("browserIngestion.dailyLimitReached")}</p>}
                {worker.health_status === "cooldown" && (
                  <div className="space-y-2">
                    <p>
                      {t("browserIngestion.workerCooldown", {
                        failures: String(worker.consecutive_failures),
                        time: worker.cooldown_until
                          ? formatLastSuccess(worker.cooldown_until, t)
                          : t("browserIngestion.unknownTime"),
                      })}
                    </p>
                    {onResetCooldown && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("browserIngestion.resetCooldownHint")}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={resetting}
                          onClick={() => {
                            setResetting(true);
                            void onResetCooldown().finally(() => setResetting(false));
                          }}
                        >
                          <RotateCcw className={cn("mr-1.5 h-3.5 w-3.5", resetting && "animate-spin")} />
                          {t("browserIngestion.resetCooldown")}
                        </Button>
                      </>
                    )}
                  </div>
                )}
                {worker.health_status === "incompatible_extension" && (
                  <p>
                    {t("browserIngestion.extensionIncompatible", {
                      current: worker.extension_version || "?",
                      required: worker.required_extension_version || "?",
                    })}
                  </p>
                )}
                {worker.restart_recommended && <p>{t("browserIngestion.restartRecommended")}</p>}
              </div>
            </div>
          )}

          {worker.current_video_url && (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">{t("browserIngestion.currentVideo")}</p>
              <p className="truncate text-sm font-medium">{worker.current_video_url}</p>
            </div>
          )}

          {dailyPct != null && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{t("browserIngestion.dailyProgress")}</span>
                <span className="tabular-nums">
                  {worker.processed_today} / {worker.max_jobs_per_day}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    dailyPct >= 100 ? "bg-amber-500" : "bg-primary",
                  )}
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              icon={MemoryStick}
              label={t("browserIngestion.workerMemory")}
              value={worker.memory_mb != null ? `${worker.memory_mb} MB` : "—"}
            />
            <Metric
              icon={Activity}
              label={t("browserIngestion.workerUptime")}
              value={formatUptime(worker.uptime_seconds)}
            />
            <Metric
              label={t("browserIngestion.workerThroughput")}
              value={
                worker.processed_per_hour != null
                  ? t("browserIngestion.perHour", { rate: String(worker.processed_per_hour) })
                  : "—"
              }
            />
            <Metric
              label={t("browserIngestion.workerToday")}
              value={`${worker.success_today} ✓ / ${worker.failed_today} ✗`}
            />
            <Metric
              icon={CheckCircle2}
              label={t("browserIngestion.lastSuccessLabel")}
              value={formatLastSuccess(worker.last_success_at, t)}
              wide
            />
            {worker.extension_version && (
              <Metric
                label={t("browserIngestion.extensionVersion")}
                value={`v${worker.extension_version}`}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  wide,
}: {
  label: string;
  value: string;
  icon?: typeof Activity;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5",
        wide && "sm:col-span-2",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
