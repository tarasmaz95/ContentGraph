"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Laptop,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { BrowserCatalogStatsSection } from "@/components/browser-ingestion/catalog-stats-section";
import { BrowserIngestionInfoCards } from "@/components/browser-ingestion/info-cards";
import { BrowserJobsTablePanel } from "@/components/browser-ingestion/jobs-table-panel";
import { BrowserRunProgressPanel } from "@/components/browser-ingestion/run-progress-panel";
import { SetupWizard } from "@/components/browser-ingestion/setup-wizard";
import { WorkerCtaBanner } from "@/components/browser-ingestion/worker-cta-banner";
import { WorkerFleetPanel } from "@/components/browser-ingestion/worker-fleet-panel";
import { WorkerLiveStatus } from "@/components/browser-ingestion/worker-live-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  clearStoredBrowserIngestionRunId,
  getStoredBrowserIngestionRunId,
  setStoredBrowserIngestionRunId,
} from "@/lib/browser-ingestion-storage";
import { WORKER_ZIP_PATH, fetchWorkerBundleMeta } from "@/lib/worker-download";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  fetchBrowserIngestionDashboard,
  fetchBrowserIngestionRun,
  clearBrowserIngestionRun,
  pauseBrowserIngestion,
  resetBrowserWorkerCooldown,
  resumeBrowserIngestion,
  retryFailedBrowserIngestion,
  startBrowserIngestion,
} from "@/services/api";
import type {
  BrowserIngestionDashboard,
  BrowserIngestionMode,
  BrowserIngestionRun,
} from "@/types/browser-ingestion";
import { isBrowserIngestionRunActive, isWorkerConnected } from "@/types/browser-ingestion";

export function BrowserIngestionPage() {
  const t = useT();
  const setupRef = useRef<HTMLDivElement>(null);
  const [dashboard, setDashboard] = useState<BrowserIngestionDashboard | null>(null);
  const [run, setRun] = useState<BrowserIngestionRun | null>(null);
  const [displayRunId, setDisplayRunId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  const [limit, setLimit] = useState(100);
  const [mode, setMode] = useState<BrowserIngestionMode>("both");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [latestOnly, setLatestOnly] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [workerBundleVersion, setWorkerBundleVersion] = useState<string | null>(null);

  const worker = dashboard?.worker ?? null;
  const workers = dashboard?.workers ?? (worker ? [worker] : []);
  const hasMultipleWorkers = workers.length > 1;
  const workerOnline = isWorkerConnected(worker);

  useEffect(() => {
    void fetchWorkerBundleMeta().then((meta) => {
      if (meta?.version) setWorkerBundleVersion(meta.version);
    });
  }, []);

  useEffect(() => {
    if (!workerOnline) return;
    setError((prev) =>
      prev === t("browserIngestion.startNeedsWorker") ? null : prev,
    );
  }, [workerOnline, t]);

  const scrollToSetup = () => {
    setupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyRun = useCallback((next: BrowserIngestionRun | null) => {
    if (next) {
      setRun(next);
      setDisplayRunId(next.id);
      setStoredBrowserIngestionRunId(next.id);
    }
  }, []);

  const loadDashboard = useCallback(async (runId?: number | null) => {
    const dash = await fetchBrowserIngestionDashboard(runId ?? undefined);
    setDashboard(dash);
    if (dash.run) {
      setRun(dash.run);
      setDisplayRunId(dash.run.id);
      setStoredBrowserIngestionRunId(dash.run.id);
    }
    return dash;
  }, []);

  const loadRunById = useCallback(
    async (runId: number) => {
      const loaded = await fetchBrowserIngestionRun(runId);
      applyRun(loaded);
      return loaded;
    },
    [applyRun],
  );

  const recoverRun = useCallback(async () => {
    const storedId = getStoredBrowserIngestionRunId();
    const dash = await loadDashboard(storedId);
    if (dash.run) return dash.run;
    if (storedId) {
      try {
        return await loadRunById(storedId);
      } catch {
        clearStoredBrowserIngestionRunId();
      }
    }
    setRun(null);
    setDisplayRunId(null);
    return null;
  }, [loadDashboard, loadRunById]);

  const load = useCallback(async () => {
    setError(null);
    try {
      await recoverRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browserIngestion.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [recoverRun, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const isActive = isBrowserIngestionRunActive(run);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const dash = await fetchBrowserIngestionDashboard(displayRunId ?? undefined);
        if (cancelled) return;
        setDashboard(dash);
        if (dash.run) {
          setRun((prev) => {
            if (
              prev &&
              prev.run_stats.processed === dash.run!.run_stats.processed &&
              prev.status === dash.run!.status
            ) {
              return prev;
            }
            return dash.run!;
          });
        }
        setJobsRefreshKey((k) => k + 1);
      } catch {
        /* keep last state */
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), isActive ? 2000 : 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [displayRunId, isActive]);

  const handleStart = async () => {
    if (!workerOnline) {
      setError(t("browserIngestion.startNeedsWorker"));
      scrollToSetup();
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await startBrowserIngestion({
        limit,
        mode,
        creator_filter: creatorFilter.trim() || null,
        latest_only: latestOnly,
        only_missing: onlyMissing,
      });
      applyRun(res.run);
      setJobsRefreshKey((k) => k + 1);
      await loadDashboard(res.run.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browserIngestion.startFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const updated = await pauseBrowserIngestion(run.id);
      setRun(updated);
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browserIngestion.pauseFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const updated = await resumeBrowserIngestion(run.id);
      applyRun(updated);
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browserIngestion.resumeFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const updated = await retryFailedBrowserIngestion(run.id);
      applyRun(updated);
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browserIngestion.retryFailedMsg"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearRun = async () => {
    if (!run) return;
    const ok = window.confirm(t("browserIngestion.clearRunConfirm", { id: String(run.id) }));
    if (!ok) return;

    setActionLoading(true);
    setError(null);
    try {
      const dash = await clearBrowserIngestionRun(run.id);
      setDashboard(dash);
      setRun(null);
      setDisplayRunId(null);
      clearStoredBrowserIngestionRunId();
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browserIngestion.clearRunFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissRun = () => {
    setRun(null);
    setDisplayRunId(null);
    clearStoredBrowserIngestionRunId();
  };

  const handleResetCooldown = async () => {
    setError(null);
    try {
      const dash = await resetBrowserWorkerCooldown();
      setDashboard(dash);
      if (dash.run) setRun(dash.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browserIngestion.resetCooldownFailed"));
      throw err;
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 pb-16">
      <PageHeader
        icon={Laptop}
        title={t("browserIngestion.title")}
        description={t("browserIngestion.subtitleFriendly")}
        sticky
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={WORKER_ZIP_PATH}
              download="contentgraph-browser-worker.zip"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              <Download className="mr-2 h-4 w-4" />
              {workerBundleVersion
                ? t("browserIngestion.downloadWorkerVersion", {
                    version: workerBundleVersion,
                  })
                : t("browserIngestion.downloadWorker")}
            </a>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              {t("browserIngestion.refresh")}
            </Button>
          </div>
        }
      />

      <div ref={setupRef}>
        <SetupWizard workerOnline={workerOnline} />
      </div>

      <BrowserIngestionInfoCards />

      <WorkerCtaBanner worker={worker} onScrollToSetup={scrollToSetup} />

      <WorkerLiveStatus worker={worker} sticky={false} onResetCooldown={handleResetCooldown} />

      {hasMultipleWorkers && (
        <WorkerFleetPanel
          workers={workers}
          activeRunId={dashboard?.active_run_id ?? null}
        />
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/transcripts/api-ingestion" className="text-primary hover:underline">
          {t("browserIngestion.linkApiIngestion")}
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/extension" className="text-primary hover:underline">
          {t("browserIngestion.linkExtension")}
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {dashboard && <BrowserCatalogStatsSection dashboard={dashboard} />}

      {run && <BrowserRunProgressPanel run={run} worker={worker} sticky={false} />}

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("browserIngestion.controls")}</CardTitle>
            <CardDescription>
              {run
                ? t("browserIngestion.controlsRunHint", { id: String(run.id) })
                : workerOnline
                  ? t("browserIngestion.runIdleReady")
                  : t("browserIngestion.runIdleFriendly")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("browserIngestion.mode")}
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as BrowserIngestionMode)}
                  disabled={isActive}
                >
                  <option value="both">{t("browserIngestion.modeBoth")}</option>
                  <option value="transcript">{t("browserIngestion.modeTranscript")}</option>
                  <option value="comments">{t("browserIngestion.modeComments")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("browserIngestion.creatorFilter")}
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  placeholder={t("browserIngestion.creatorPlaceholder")}
                  disabled={isActive}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("browserIngestion.limit")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  disabled={isActive}
                />
              </div>
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={onlyMissing}
                    onChange={(e) => setOnlyMissing(e.target.checked)}
                    disabled={isActive}
                  />
                  {t("browserIngestion.onlyMissing")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={latestOnly}
                    onChange={(e) => setLatestOnly(e.target.checked)}
                    disabled={isActive}
                  />
                  {t("browserIngestion.latestOnly")}
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button
                onClick={() => void handleStart()}
                disabled={actionLoading || isActive}
                size="lg"
                className="w-full sm:w-auto"
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {t("browserIngestion.startFriendly")}
              </Button>
              {run?.status === "running" && (
                <Button variant="outline" onClick={() => void handlePause()} disabled={actionLoading}>
                  <Pause className="mr-2 h-4 w-4" />
                  {t("browserIngestion.pause")}
                </Button>
              )}
              {run?.status === "paused" && (
                <Button variant="outline" onClick={() => void handleResume()} disabled={actionLoading}>
                  <Play className="mr-2 h-4 w-4" />
                  {t("browserIngestion.resume")}
                </Button>
              )}
              {run && (run.run_stats.failed > 0 || run.status === "completed") && (
                <Button
                  variant="secondary"
                  onClick={() => void handleRetry()}
                  disabled={actionLoading}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("browserIngestion.retryFailed")}
                </Button>
              )}
              {run && (
                <Button
                  variant="outline"
                  onClick={() => void handleClearRun()}
                  disabled={actionLoading}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("browserIngestion.clearRun")}
                </Button>
              )}
              {run && !isActive && (
                <Button variant="ghost" size="sm" onClick={handleDismissRun}>
                  {t("browserIngestion.dismissRun")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {displayRunId ? (
          <BrowserJobsTablePanel
            runId={displayRunId}
            refreshKey={jobsRefreshKey}
            onRetryFailed={() => void handleRetry()}
          />
        ) : (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-sm text-muted-foreground">
                {t("browserIngestion.jobsEmptyStartFriendly")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
