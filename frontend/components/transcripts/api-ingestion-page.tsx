"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { CatalogStatsSection } from "@/components/transcripts/api-ingestion/catalog-stats-section";
import { JobsTablePanel } from "@/components/transcripts/api-ingestion/jobs-table-panel";
import { RunProgressPanel } from "@/components/transcripts/api-ingestion/run-progress-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  clearStoredIngestionRunId,
  getStoredIngestionRunId,
  setStoredIngestionRunId,
} from "@/lib/transcript-api-ingestion-storage";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  fetchActiveTranscriptApiIngestionRun,
  fetchTranscriptApiIngestionRun,
  fetchTranscriptApiIngestionStats,
  pauseTranscriptApiIngestion,
  resumeTranscriptApiIngestion,
  retryFailedTranscriptApiIngestion,
  startTranscriptApiIngestion,
} from "@/services/api";
import type {
  CatalogCoverageStats,
  TranscriptApiIngestionRun,
} from "@/types/transcript-api-ingestion";
import { isApiIngestionRunActive } from "@/types/transcript-api-ingestion";

export function ApiIngestionPage() {
  const t = useT();
  const [catalog, setCatalog] = useState<CatalogCoverageStats | null>(null);
  const [run, setRun] = useState<TranscriptApiIngestionRun | null>(null);
  const [displayRunId, setDisplayRunId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  const [limit, setLimit] = useState(500);
  const [workers, setWorkers] = useState(5);
  const [creatorFilter, setCreatorFilter] = useState("");
  const [latestOnly, setLatestOnly] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(true);

  const applyRun = useCallback((next: TranscriptApiIngestionRun | null) => {
    if (next) {
      setRun(next);
      setDisplayRunId(next.id);
      setStoredIngestionRunId(next.id);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    const dash = await fetchTranscriptApiIngestionStats();
    setCatalog(dash.catalog);
    return dash;
  }, []);

  const loadRunById = useCallback(
    async (runId: number) => {
      const loaded = await fetchTranscriptApiIngestionRun(runId);
      applyRun(loaded);
      return loaded;
    },
    [applyRun],
  );

  const recoverRun = useCallback(async () => {
    const dash = await loadCatalog();
    let next = await fetchActiveTranscriptApiIngestionRun();
    if (next) {
      applyRun(next);
      return next;
    }
    const storedId = dash.active_run_id ?? getStoredIngestionRunId();
    if (storedId) {
      try {
        next = await loadRunById(storedId);
        return next;
      } catch {
        clearStoredIngestionRunId();
      }
    }
    setRun(null);
    setDisplayRunId(null);
    return null;
  }, [applyRun, loadCatalog, loadRunById]);

  const load = useCallback(async () => {
    setError(null);
    try {
      await recoverRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("transcriptApiIngestion.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [recoverRun, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const isActive = isApiIngestionRunActive(run);

  useEffect(() => {
    if (!displayRunId || !isActive) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const active = await fetchActiveTranscriptApiIngestionRun();
        if (cancelled) return;

        if (active && active.id === displayRunId) {
          setRun((prev) => {
            if (
              prev &&
              prev.run_stats.processed === active.run_stats.processed &&
              prev.status === active.status
            ) {
              return prev;
            }
            return active;
          });
          setCatalog(active.catalog);
          setJobsRefreshKey((k) => k + 1);
          return;
        }

        if (!active) {
          const terminal = await fetchTranscriptApiIngestionRun(displayRunId);
          if (cancelled) return;
          setRun(terminal);
          setCatalog(terminal.catalog);
          setJobsRefreshKey((k) => k + 1);
          await loadCatalog();
        }
      } catch {
        /* keep last known state */
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [displayRunId, isActive, loadCatalog]);

  const handleStart = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await startTranscriptApiIngestion({
        limit,
        worker_count: workers,
        creator_filter: creatorFilter.trim() || null,
        latest_only: latestOnly,
        only_missing: onlyMissing,
      });
      applyRun(res.run);
      setCatalog(res.run.catalog);
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("transcriptApiIngestion.startFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const updated = await pauseTranscriptApiIngestion(run.id);
      setRun(updated);
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("transcriptApiIngestion.pauseFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const updated = await resumeTranscriptApiIngestion(run.id);
      applyRun(updated);
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("transcriptApiIngestion.resumeFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const updated = await retryFailedTranscriptApiIngestion(run.id);
      applyRun(updated);
      setJobsRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("transcriptApiIngestion.retryFailedMsg"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissRun = () => {
    setRun(null);
    setDisplayRunId(null);
    clearStoredIngestionRunId();
  };

  if (loading && !catalog) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 pb-16">
      <PageHeader
        icon={FileText}
        title={t("transcriptApiIngestion.title")}
        description={t("transcriptApiIngestion.subtitle")}
        sticky
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            {t("transcriptApiIngestion.refresh")}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/intelligence/health" className="text-primary hover:underline">
          {t("transcriptApiIngestion.linkHealth")}
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/extension" className="text-primary hover:underline">
          {t("transcriptApiIngestion.linkExtension")}
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {catalog && <CatalogStatsSection catalog={catalog} />}

      {run && <RunProgressPanel run={run} sticky={isActive} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("transcriptApiIngestion.controls")}</CardTitle>
            <CardDescription>
              {run
                ? t("transcriptApiIngestion.controlsRunHint", { id: String(run.id) })
                : t("transcriptApiIngestion.runIdle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
                disabled={isActive}
              />
              {t("transcriptApiIngestion.onlyMissing")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={latestOnly}
                onChange={(e) => setLatestOnly(e.target.checked)}
                disabled={isActive}
              />
              {t("transcriptApiIngestion.latestOnly")}
            </label>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t("transcriptApiIngestion.creatorFilter")}
              </label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
                placeholder={t("transcriptApiIngestion.creatorPlaceholder")}
                disabled={isActive}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("transcriptApiIngestion.limit")}
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
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("transcriptApiIngestion.workers")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={workers}
                  onChange={(e) => setWorkers(Number(e.target.value))}
                  disabled={isActive && run?.status !== "paused"}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void handleStart()} disabled={actionLoading || isActive}>
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {t("transcriptApiIngestion.start")}
              </Button>
              {run?.status === "running" && (
                <Button variant="outline" onClick={() => void handlePause()} disabled={actionLoading}>
                  <Pause className="mr-2 h-4 w-4" />
                  {t("transcriptApiIngestion.pause")}
                </Button>
              )}
              {run?.status === "paused" && (
                <Button variant="outline" onClick={() => void handleResume()} disabled={actionLoading}>
                  <Play className="mr-2 h-4 w-4" />
                  {t("transcriptApiIngestion.resume")}
                </Button>
              )}
              {run && (run.run_stats.failed > 0 || run.status === "completed") && (
                <Button
                  variant="secondary"
                  onClick={() => void handleRetry()}
                  disabled={actionLoading}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("transcriptApiIngestion.retryFailed")}
                </Button>
              )}
              {run && !isActive && (
                <Button variant="ghost" size="sm" onClick={handleDismissRun}>
                  {t("transcriptApiIngestion.dismissRun")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {displayRunId ? (
          <JobsTablePanel runId={displayRunId} refreshKey={jobsRefreshKey} />
        ) : (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-sm text-muted-foreground">
                {t("transcriptApiIngestion.jobsEmptyStart")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
