"use client";

import { Activity, CheckCircle2, Laptop, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import {
  friendlyHealth,
  friendlyPhase,
  isWorkerProcessing,
} from "@/lib/browser-ingestion-labels";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";
import type { BrowserIngestionWorker } from "@/types/browser-ingestion";
import { isWorkerConnected } from "@/types/browser-ingestion";

function healthVariant(health: string): "success" | "warning" | "muted" {
  if (health === "healthy") return "success";
  if (health === "offline" || health === "unknown") return "muted";
  return "warning";
}

export function WorkerFleetPanel({
  workers,
  activeRunId,
}: {
  workers: BrowserIngestionWorker[];
  activeRunId: number | null;
}) {
  const t = useT();
  if (!workers || workers.length === 0) return null;

  const online = workers.filter((w) => isWorkerConnected(w)).length;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("browserIngestion.fleetTitle")}</CardTitle>
          </div>
          <Badge variant={online > 0 ? "success" : "muted"}>
            {t("browserIngestion.fleetOnlineCount", {
              online: String(online),
              total: String(workers.length),
            })}
          </Badge>
        </div>
        <CardDescription>
          {activeRunId
            ? t("browserIngestion.fleetDescRun", { id: String(activeRunId) })
            : t("browserIngestion.fleetDescIdle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {workers.map((w) => (
          <WorkerRow key={w.id} worker={w} />
        ))}
      </CardContent>
    </Card>
  );
}

function WorkerRow({ worker }: { worker: BrowserIngestionWorker }) {
  const t = useT();
  const connected = isWorkerConnected(worker);
  const processing = isWorkerProcessing(worker.current_phase, worker.current_action);
  const success = worker.jobs_in_run_success ?? 0;
  const failed = worker.jobs_in_run_failed ?? 0;
  const inFlight = worker.jobs_in_run_processing ?? 0;

  const heartbeat =
    worker.last_heartbeat_at != null
      ? formatRelativeTime(worker.last_heartbeat_at)
      : "—";

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        connected
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/60 bg-muted/20 opacity-80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                connected ? "bg-emerald-500" : "bg-muted-foreground/40",
                connected && processing && "animate-pulse",
              )}
              aria-hidden
            />
            <p className="truncate text-sm font-semibold">{worker.name}</p>
            <Badge variant={healthVariant(worker.health_status)}>
              {friendlyHealth(worker.health_status, t)}
            </Badge>
            {worker.extension_version && (
              <span className="text-xs text-muted-foreground">
                ext v{worker.extension_version}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t("browserIngestion.lastHeartbeat")}: {heartbeat}
            </span>
            {processing && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Activity className="h-3 w-3 animate-pulse" />
                {friendlyPhase(worker.current_phase || worker.current_action, t)}
              </span>
            )}
          </div>

          {worker.current_video_url && processing && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              <span className="font-medium">
                {t("browserIngestion.currentVideo")}:
              </span>{" "}
              {worker.current_video_url}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Stat
            icon={CheckCircle2}
            tone="success"
            label={t("browserIngestion.fleetRunSuccess")}
            value={success}
          />
          <Stat
            icon={XCircle}
            tone="danger"
            label={t("browserIngestion.fleetRunFailed")}
            value={failed}
          />
          <Stat
            icon={Loader2}
            tone="processing"
            label={t("browserIngestion.fleetRunInFlight")}
            value={inFlight}
            spinning={inFlight > 0}
          />
          <Stat
            label={t("browserIngestion.fleetToday")}
            value={`${worker.success_today} ✓ / ${worker.failed_today} ✗`}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  spinning,
}: {
  icon?: typeof Activity;
  tone?: "success" | "danger" | "processing";
  label: string;
  value: number | string;
  spinning?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        {Icon && (
          <Icon
            className={cn(
              "h-3 w-3",
              tone === "success" && "text-emerald-600",
              tone === "danger" && "text-destructive",
              tone === "processing" && "text-primary",
              spinning && "animate-spin",
            )}
          />
        )}
        {label}
      </div>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "success" && Number(value) > 0 && "text-emerald-700 dark:text-emerald-400",
          tone === "danger" && Number(value) > 0 && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
