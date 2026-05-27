"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  ImageIcon,
  Loader2,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchBrowserIngestionJobs } from "@/services/api";
import {
  commentsOutcomeTone,
  friendlyCommentsOutcome,
  friendlyFailure,
  friendlyJobStatus,
  friendlyTranscriptOutcome,
  outcomeBadgeClass,
  transcriptOutcomeTone,
} from "@/lib/browser-ingestion-labels";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BrowserIngestionJob, BrowserJobStatusFilter } from "@/types/browser-ingestion";

const PAGE_SIZE = 50;

const FILTERS: BrowserJobStatusFilter[] = [
  "all",
  "queued",
  "processing",
  "success",
  "failed",
  "skipped",
];

function statusBadge(status: string): string {
  switch (status) {
    case "success":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "processing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "queued":
      return "bg-muted text-muted-foreground";
    case "failed":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "skipped":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatUtc(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function BrowserJobsTablePanel({
  runId,
  refreshKey,
  onRetryFailed,
}: {
  runId: number;
  refreshKey: number;
  onRetryFailed?: () => void;
}) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<BrowserJobStatusFilter>("all");
  const [jobs, setJobs] = useState<BrowserIngestionJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadPage = useCallback(
    async (offset: number, append: boolean, filter: BrowserJobStatusFilter) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const page = await fetchBrowserIngestionJobs(runId, {
          status: filter,
          offset,
          limit: PAGE_SIZE,
        });
        setTotal(page.total);
        setJobs((prev) => (append ? [...prev, ...page.items] : page.items));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("browserIngestion.jobsLoadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [runId, t],
  );

  useEffect(() => {
    void loadPage(0, false, statusFilter);
  }, [runId, statusFilter, refreshKey, loadPage]);

  const hasMore = jobs.length < total;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t("browserIngestion.jobsTable")}</CardTitle>
          <CardDescription className="tabular-nums">
            {t("browserIngestion.jobsShowing", {
              shown: String(jobs.length),
              total: String(total),
            })}
          </CardDescription>
        </div>
        {failedCount > 0 && onRetryFailed && (
          <Button variant="secondary" size="sm" onClick={onRetryFailed}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("browserIngestion.retryFailed")}
          </Button>
        )}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {t(`browserIngestion.filter.${f}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading && jobs.length === 0 ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("browserIngestion.jobsEmpty")}
            description={t("browserIngestion.jobsEmptyHint")}
          />
        ) : (
          <>
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="w-6 py-2" />
                  <th className="py-2 pr-2">{t("browserIngestion.colTitle")}</th>
                  <th className="py-2 pr-2">{t("browserIngestion.colStatus")}</th>
                  <th className="py-2 pr-2">{t("browserIngestion.colTranscript")}</th>
                  <th className="py-2 pr-2">{t("browserIngestion.colComments")}</th>
                  <th className="py-2 pr-2">{t("browserIngestion.colRetries")}</th>
                  <th className="py-2 pr-2">{t("browserIngestion.colDuration")}</th>
                  <th className="py-2">{t("browserIngestion.colUpdated")}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const expanded = expandedId === job.id;
                  const hasDetails =
                    job.status === "failed" ||
                    Boolean(job.error_message) ||
                    job.retry_history.length > 0 ||
                    Boolean(job.screenshot_path) ||
                    Boolean(job.failure_category);
                  const friendlyFail = friendlyFailure(job.failure_category, t);
                  const transcriptLabel = friendlyTranscriptOutcome(job.transcript_outcome, t);
                  const commentsLabel = friendlyCommentsOutcome(job.comments_outcome, t);

                  return (
                    <Fragment key={job.id}>
                      <tr className="border-b border-border/60">
                        <td className="py-2">
                          {hasDetails ? (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => setExpandedId(expanded ? null : job.id)}
                              aria-label={t("browserIngestion.toggleDetails")}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}
                        </td>
                        <td className="max-w-[200px] truncate py-2 pr-2" title={job.title}>
                          <Link
                            href={`/videos/${job.video_id}`}
                            className="hover:text-primary"
                          >
                            {job.title}
                          </Link>
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className={cn(
                              "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                              statusBadge(job.status),
                            )}
                          >
                            {friendlyJobStatus(job.status, t)}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          {transcriptLabel ? (
                            <span
                              className={cn(
                                "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                                outcomeBadgeClass(transcriptOutcomeTone(job.transcript_outcome)),
                              )}
                            >
                              {transcriptLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {commentsLabel ? (
                            <span
                              className={cn(
                                "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                                outcomeBadgeClass(commentsOutcomeTone(job.comments_outcome)),
                              )}
                            >
                              {commentsLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-xs">{job.retry_count}</td>
                        <td className="py-2 pr-2 tabular-nums text-xs">
                          {job.duration_seconds != null ? `${job.duration_seconds}s` : "—"}
                        </td>
                        <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                          {formatUtc(job.updated_at)}
                        </td>
                      </tr>
                      {expanded && hasDetails && (
                        <tr className="border-b border-border/40 bg-muted/20">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
                              {friendlyFail && (
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    job.status === "failed"
                                      ? "text-foreground"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {t("browserIngestion.colCategory")}: {friendlyFail}
                                </p>
                              )}
                              {job.screenshot_path && (
                                <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                                  <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs font-medium">
                                      {t("browserIngestion.screenshotOnLaptop")}
                                    </p>
                                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                                      {job.screenshot_path}
                                    </p>
                                  </div>
                                </div>
                              )}
                              <details className="text-sm">
                                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                                  {t("browserIngestion.whatHappened")}
                                </summary>
                                <div className="mt-2 space-y-2 pl-2 text-xs text-muted-foreground">
                                  {job.error_message && (
                                    <p className="whitespace-pre-wrap text-destructive/90">
                                      {job.error_message}
                                    </p>
                                  )}
                                  {job.retry_history.length > 0 && (
                                    <ul className="list-inside list-disc">
                                      {job.retry_history.map((line, i) => (
                                        <li key={i}>{line}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </details>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void loadPage(jobs.length, true, statusFilter)}
                >
                  {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("browserIngestion.loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
