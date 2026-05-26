"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fetchIntelligenceHealth, runSnapshotsNow } from "@/services/api";
import type {
  CreatorCoverageRow,
  FreshnessSeverity,
  HealthLevel,
  IntelligenceHealthResponse,
  SeverityLevel,
} from "@/types/intelligence-health";

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

function statusBorder(level: HealthLevel): string {
  switch (level) {
    case "healthy":
      return "border-green-500/40 bg-green-500/5";
    case "partial":
      return "border-amber-500/40 bg-amber-500/5";
    case "degraded":
      return "border-orange-500/40 bg-orange-500/5";
    case "critical":
      return "border-red-500/40 bg-red-500/5";
  }
}

function freshnessBorder(s: FreshnessSeverity): string {
  if (s === "green") return "border-green-500/30";
  if (s === "amber") return "border-amber-500/30";
  return "border-red-500/30";
}

function warningStyles(s: SeverityLevel): string {
  if (s === "critical") return "border-red-500/40 bg-red-500/5";
  if (s === "warning") return "border-amber-500/40 bg-amber-500/5";
  return "border-border bg-muted/30";
}

type SortKey = "creator_name" | "video_count" | "transcript_pct" | "comment_pct" | "embedding_pct";

export default function IntelligenceHealthPage() {
  const t = useT();
  const [data, setData] = useState<IntelligenceHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningSnapshot, setRunningSnapshot] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("video_count");
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchIntelligenceHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("health.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedCreators = useMemo(() => {
    if (!data) return [];
    const rows = [...data.creator_coverage.rows];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return rows;
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleRunSnapshot = async () => {
    if (!window.confirm(t("health.snapshots.confirmRun"))) return;
    setRunningSnapshot(true);
    try {
      await runSnapshotsNow();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("health.snapshots.runFailed"));
    } finally {
      setRunningSnapshot(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
        <Button variant="outline" onClick={() => void load()}>
          {t("common.refresh")}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const o = data.overview;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          icon={Activity}
          title={t("health.title")}
          description={t("health.description")}
        />
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          {t("common.refresh")}
        </Button>
      </div>

      <section
        className={cn("rounded-lg border px-5 py-4", statusBorder(data.system_status.level))}
      >
        <p className="text-sm font-semibold text-foreground">{data.system_status.headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{data.system_status.summary}</p>
        <p className="mt-2 text-[11px] text-muted-foreground/80">
          {t("health.generatedAt")}: {formatUtc(data.generated_at)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("health.overview")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("health.totalVideos"), value: o.total_videos.toLocaleString() },
            {
              label: t("health.transcriptCoverage"),
              value: `${o.transcript_coverage_pct}% (${o.videos_with_transcripts})`,
            },
            {
              label: t("health.commentCoverage"),
              value: `${o.comment_coverage_pct}% (${o.videos_with_comments})`,
            },
            {
              label: t("health.embeddingCoverage"),
              value: `${o.embedding_coverage_pct}%`,
            },
            { label: t("health.creators"), value: o.creators_tracked.toLocaleString() },
            {
              label: t("health.snapshotDays"),
              value: `${o.snapshot_days}${o.latest_snapshot_date ? ` · ${o.latest_snapshot_date}` : ""}`,
            },
            { label: t("health.lastSync"), value: formatUtc(o.last_catalog_sync_at) },
            { label: t("health.lastComments"), value: formatUtc(o.last_comment_ingest_at) },
          ].map((card) => (
            <Card key={card.label} className="shadow-none">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-[11px]">{card.label}</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-sm font-medium tabular-nums">
                {card.value}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{o.last_transcript_activity_note}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("health.freshness")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.freshness.metrics.map((m) => (
            <div
              key={m.label}
              className={cn("rounded-md border px-3 py-2", freshnessBorder(m.severity))}
            >
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-semibold tabular-nums">{m.value.toLocaleString()}</p>
              {m.hint ? (
                <p className="mt-1 text-[10px] text-muted-foreground">{m.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("health.warnings")}
        </h2>
        <ul className="space-y-2">
          {data.warnings.map((w) => (
            <li
              key={w.id}
              className={cn("rounded-md border px-3 py-2 text-sm", warningStyles(w.severity))}
            >
              <p className="font-medium">{w.message}</p>
              {w.detail ? (
                <p className="mt-1 text-xs text-muted-foreground">{w.detail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("health.creatorCoverage")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {data.creator_coverage.strongest_creator &&
              t("health.strongest", { name: data.creator_coverage.strongest_creator })}
            {data.creator_coverage.weakest_creator &&
              ` · ${t("health.weakest", { name: data.creator_coverage.weakest_creator })}`}
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b bg-muted/50">
              <tr>
                {(
                  [
                    ["creator_name", t("health.colCreator")],
                    ["video_count", t("health.colVideos")],
                    ["transcript_pct", t("health.colTranscript")],
                    ["comment_pct", t("health.colComments")],
                    ["embedding_pct", t("health.colEmbed")],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-2 py-2 font-medium">
                    <button
                      type="button"
                      className="hover:text-primary"
                      onClick={() => toggleSort(key)}
                    >
                      {label}
                      {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCreators.map((row: CreatorCoverageRow) => (
                <tr
                  key={row.creator_name}
                  className={cn(
                    "border-b last:border-0",
                    row.is_strongest_coverage && "bg-green-500/5",
                    row.is_weakest_coverage && "bg-amber-500/5",
                  )}
                >
                  <td className="px-2 py-2 font-medium">{row.creator_name}</td>
                  <td className="px-2 py-2 tabular-nums">{row.video_count}</td>
                  <td className="px-2 py-2 tabular-nums">{row.transcript_pct}%</td>
                  <td className="px-2 py-2 tabular-nums">{row.comment_pct}%</td>
                  <td className="px-2 py-2 tabular-nums">{row.embedding_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              {t("health.transcripts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-muted-foreground">{t("health.totalTranscripts")}</dt>
              <dd className="font-mono">{data.transcripts.total_transcripts}</dd>
              <dt className="text-muted-foreground">{t("health.avgLength")}</dt>
              <dd className="font-mono">{data.transcripts.avg_transcript_length}</dd>
              <dt className="text-muted-foreground">{t("health.missingEmbeddings")}</dt>
              <dd className="font-mono">{data.transcripts.transcripts_missing_embeddings}</dd>
              <dt className="text-muted-foreground">{t("health.missingTranscript")}</dt>
              <dd className="font-mono">{data.transcripts.videos_missing_transcript}</dd>
            </dl>
            <p className="text-[11px] text-muted-foreground">
              {data.transcripts.source_tracking_note}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              {t("health.comments")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-muted-foreground">{t("health.totalComments")}</dt>
              <dd className="font-mono">{data.comments.total_comments}</dd>
              <dt className="text-muted-foreground">{t("health.avgPerVideo")}</dt>
              <dd className="font-mono">{data.comments.avg_comments_per_video}</dd>
              <dt className="text-muted-foreground">{t("health.emotionalTags")}</dt>
              <dd className="font-mono">{data.comments.emotional_tags_coverage_pct}%</dd>
              <dt className="text-muted-foreground">{t("health.neutralOnly")}</dt>
              <dd className="font-mono">{data.comments.neutral_only_pct}%</dd>
              <dt className="text-muted-foreground">{t("health.topVideoShare")}</dt>
              <dd className="font-mono">{data.comments.top_video_comment_share_pct}%</dd>
            </dl>
            {data.comments.top_synced_creators.length > 0 && (
              <ul className="text-xs text-muted-foreground">
                {data.comments.top_synced_creators.map((c) => (
                  <li key={c.creator_name}>
                    {c.creator_name}: {c.comment_count}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("health.snapshots.title")}
          </h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={runningSnapshot}
            onClick={() => void handleRunSnapshot()}
          >
            {runningSnapshot ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {t("health.snapshots.runNow")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("health.snapshots.changingVideos", {
            count: data.snapshots.videos_with_changing_snapshots,
            days: data.snapshots.snapshot_days,
          })}
          {data.snapshots.next_scheduled_at &&
            ` · ${t("health.snapshots.next")}: ${formatUtc(data.snapshots.next_scheduled_at)}`}
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-2 py-2">{t("health.snapshots.colTime")}</th>
                <th className="px-2 py-2">{t("health.snapshots.colStatus")}</th>
                <th className="px-2 py-2">{t("health.snapshots.colDuration")}</th>
                <th className="px-2 py-2">{t("health.snapshots.colCreators")}</th>
                <th className="px-2 py-2">{t("health.snapshots.colVideos")}</th>
                <th className="px-2 py-2">{t("health.snapshots.colSource")}</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshots.recent_runs.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-mono">
                    {formatUtc(row.finished_at ?? row.started_at)}
                  </td>
                  <td className="px-2 py-2 capitalize">{row.status}</td>
                  <td className="px-2 py-2 font-mono">
                    {row.duration_ms != null ? `${row.duration_ms} ms` : "—"}
                  </td>
                  <td className="px-2 py-2 font-mono">{row.creators_saved}</td>
                  <td className="px-2 py-2 font-mono">{row.videos_saved}</td>
                  <td className="px-2 py-2">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.snapshots.recent_runs.some((r) => r.error_message) && (
          <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {data.snapshots.recent_runs.find((r) => r.error_message)?.error_message}
          </p>
        )}
      </section>
    </div>
  );
}
