"use client";

import { useCallback, useEffect, useState } from "react";
import { Circle, Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import {
  fetchSnapshotHistory,
  fetchSnapshotStatus,
  runSnapshotsNow,
} from "@/services/api";
import type { SnapshotRunHistoryItem, SnapshotStatus } from "@/types/snapshot";

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function StatusDot({ status }: { status: string | null }) {
  if (status === "success") {
    return <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" aria-hidden />;
  }
  if (status === "failed") {
    return <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" aria-hidden />;
  }
  return <Circle className="h-2.5 w-2.5 fill-muted-foreground text-muted-foreground" aria-hidden />;
}

interface SnapshotStatusBlockProps {
  onToast: (message: string, variant: "success" | "error") => void;
}

/** Snapshot cron status, manual run, last 5 runs — Settings only. */
export function SnapshotStatusBlock({ onToast }: SnapshotStatusBlockProps) {
  const t = useT();
  const [status, setStatus] = useState<SnapshotStatus | null>(null);
  const [history, setHistory] = useState<SnapshotRunHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, hist] = await Promise.all([
        fetchSnapshotStatus(),
        fetchSnapshotHistory(5),
      ]);
      setStatus(st);
      setHistory(hist.items);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : t("settings.snapshotStatus.loadFailed"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [onToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runSnapshotsNow();
      onToast(
        t("settings.snapshotStatus.runSuccess", {
          creators: result.creators_saved,
          videos: result.videos_saved,
        }),
        "success",
      );
      await load();
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : t("settings.snapshotStatus.runFailed"),
        "error",
      );
      await load();
    } finally {
      setRunning(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  const lastStatus = status?.last_status ?? null;
  const isSuccess = lastStatus === "success";

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <StatusDot status={lastStatus} />
          {t("settings.snapshotStatus.title")}
        </h3>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={running}
          onClick={() => void handleRun()}
        >
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {t("settings.snapshotStatus.runNow")}
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t("settings.snapshotStatus.lastTime")}</dt>
          <dd className="font-mono font-medium text-foreground">
            {formatUtc(status?.last_finished_at ?? status?.last_started_at)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("settings.snapshotStatus.lastStatus")}</dt>
          <dd className="font-medium capitalize text-foreground">
            {lastStatus ?? t("settings.snapshotStatus.never")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("settings.snapshotStatus.creators")}</dt>
          <dd className="font-mono text-foreground">
            {status?.creators_saved ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("settings.snapshotStatus.videos")}</dt>
          <dd className="font-mono text-foreground">{status?.videos_saved ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("settings.snapshotStatus.duration")}</dt>
          <dd className="font-mono text-foreground">
            {formatDuration(status?.duration_ms)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("settings.snapshotStatus.nextRun")}</dt>
          <dd className="font-mono text-foreground">
            {status?.scheduler_enabled
              ? formatUtc(status?.next_scheduled_at)
              : t("settings.snapshotStatus.schedulerOff")}
          </dd>
        </div>
      </dl>

      {lastStatus === "failed" && status?.error_message && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {status.error_message}
        </p>
      )}

      {history.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[320px] text-left text-xs">
            <thead className="border-b bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">{t("settings.snapshotStatus.colTime")}</th>
                <th className="px-2 py-2 font-medium">{t("settings.snapshotStatus.colStatus")}</th>
                <th className="px-2 py-2 font-medium">{t("settings.snapshotStatus.colDuration")}</th>
                <th className="px-2 py-2 font-medium">{t("settings.snapshotStatus.colCreators")}</th>
                <th className="px-2 py-2 font-medium">{t("settings.snapshotStatus.colVideos")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-2 py-2 font-mono">
                    {formatUtc(row.finished_at ?? row.started_at)}
                  </td>
                  <td className="px-2 py-2 capitalize">
                    <span className="inline-flex items-center gap-1">
                      <StatusDot status={row.status} />
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono">{formatDuration(row.duration_ms)}</td>
                  <td className="px-2 py-2 font-mono">{row.creators_saved}</td>
                  <td className="px-2 py-2 font-mono">{row.videos_saved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">{t("settings.snapshotStatus.noHistory")}</p>
      )}

      {!isSuccess && lastStatus === null && (
        <p className="text-xs text-muted-foreground">{t("settings.snapshotStatus.hintFirstRun")}</p>
      )}
    </div>
  );
}
