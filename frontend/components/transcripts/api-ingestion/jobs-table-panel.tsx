"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchTranscriptApiIngestionJobs } from "@/services/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  JobStatusFilter,
  TranscriptApiIngestionJob,
} from "@/types/transcript-api-ingestion";

const PAGE_SIZE = 50;

const FILTERS: JobStatusFilter[] = [
  "all",
  "queued",
  "processing",
  "success",
  "failed",
  "unavailable",
];

function statusBadge(status: string): string {
  switch (status) {
    case "success":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "processing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "queued":
      return "bg-muted text-muted-foreground";
    case "unavailable":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
    case "failed":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "skipped_existing":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatUtc(iso: string): string {
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

export function JobsTablePanel({
  runId,
  refreshKey,
}: {
  runId: number;
  /** Bump to reload first page (e.g. on poll tick). */
  refreshKey: number;
}) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("all");
  const [jobs, setJobs] = useState<TranscriptApiIngestionJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (offset: number, append: boolean, filter: JobStatusFilter) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const page = await fetchTranscriptApiIngestionJobs(runId, {
          status: filter,
          offset,
          limit: PAGE_SIZE,
        });
        setTotal(page.total);
        setJobs((prev) => (append ? [...prev, ...page.items] : page.items));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("transcriptApiIngestion.jobsLoadFailed"));
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

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t("transcriptApiIngestion.jobsTable")}</CardTitle>
          <CardDescription className="tabular-nums">
            {t("transcriptApiIngestion.jobsShowing", {
              shown: String(jobs.length),
              total: String(total),
            })}
          </CardDescription>
        </div>
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
              {t(`transcriptApiIngestion.filter.${f}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("transcriptApiIngestion.jobsLoading")}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("transcriptApiIngestion.jobsEmpty")}
            description={t("transcriptApiIngestion.jobsEmptyHint")}
          />
        ) : (
          <>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">{t("transcriptApiIngestion.colTitle")}</th>
                  <th className="py-2 pr-2">{t("transcriptApiIngestion.colCreator")}</th>
                  <th className="py-2 pr-2">{t("transcriptApiIngestion.colStatus")}</th>
                  <th className="py-2 pr-2">{t("transcriptApiIngestion.colChars")}</th>
                  <th className="py-2 pr-2">{t("transcriptApiIngestion.colEmbed")}</th>
                  <th className="py-2 pr-2">{t("transcriptApiIngestion.colSheets")}</th>
                  <th className="py-2 pr-2">{t("transcriptApiIngestion.colError")}</th>
                  <th className="py-2">{t("transcriptApiIngestion.colUpdated")}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-border/60">
                    <td className="max-w-[200px] truncate py-2 pr-2" title={job.title}>
                      <Link href={`/videos/${job.video_id}`} className="hover:text-primary">
                        {job.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-2">{job.creator_name}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                          statusBadge(job.status),
                        )}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{job.transcript_chars || "—"}</td>
                    <td className="py-2 pr-2">{job.embedding_created ? "✓" : "—"}</td>
                    <td className="py-2 pr-2">
                      {job.sheets_writeback}
                      {job.sheets_rows_updated > 0 ? ` (${job.sheets_rows_updated})` : ""}
                    </td>
                    <td
                      className="max-w-[160px] truncate py-2 pr-2 text-xs text-muted-foreground"
                      title={job.error_message ?? ""}
                    >
                      {job.error_message ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                      {formatUtc(job.updated_at)}
                    </td>
                  </tr>
                ))}
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
                  {t("transcriptApiIngestion.loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
