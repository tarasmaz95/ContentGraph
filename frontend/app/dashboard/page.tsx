"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Settings, Sparkles } from "lucide-react";
import { Suspense } from "react";

import {
  DashboardSearchStatus,
  type DashboardSearchKind,
} from "@/components/dashboard/dashboard-search-status";
import { MetricCards } from "@/components/analytics/metric-cards";
import { useCopilotContext } from "@/components/copilot/copilot-context";
import { DashboardResearch } from "@/components/research/dashboard-research";
import { SemanticSearchPanel } from "@/components/videos/semantic-search";
import { VideosTable } from "@/components/videos/videos-table";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PromptChips } from "@/components/ui/prompt-chips";
import { InfoTip } from "@/components/ui/info-tip";
import { getPagePrompts, useLocale, useT } from "@/lib/i18n";
import { runExamplePrompt } from "@/lib/prompt-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SHEETS_SYNC_COMPLETE_EVENT } from "@/components/sync/sheets-sync-context";
import { LastSyncBadge } from "@/components/sync/last-sync-badge";
import { SheetsSyncButtons } from "@/components/sync/sheets-sync-buttons";
import { useSheetsSync } from "@/components/sync/sheets-sync-context";
import {
  fetchCatalogStats,
  fetchDashboardAnalytics,
  fetchVideos,
  searchVideos,
} from "@/services/api";
import type { DashboardAnalytics } from "@/types/analytics";
import type { CatalogStats, Video } from "@/types/video";

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardInner />
    </Suspense>
  );
}

/**
 * Dashboard — exploration mode (empty query) vs search mode (active retrieval).
 */
function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const { locale } = useLocale();
  const pagePrompts = getPagePrompts(locale).dashboard;
  const { setCollapsed, setDashboardSearchQuery } = useCopilotContext();

  const deepLinkSemantic = searchParams.get("semantic")?.trim() ?? "";
  const deepLinkKeyword = searchParams.get("q")?.trim() ?? "";

  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [keywordInput, setKeywordInput] = useState(deepLinkKeyword);
  const [loading, setLoading] = useState(true);
  const { lastSync, isActive, isStarting } = useSheetsSync();
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(null);
  const [dataReady, setDataReady] = useState(false);

  /** Active query that produced the current table (empty = exploration mode) */
  const [activeSearchQuery, setActiveSearchQuery] = useState(
    deepLinkSemantic || deepLinkKeyword,
  );
  const [searchKind, setSearchKind] = useState<DashboardSearchKind | null>(
    deepLinkSemantic ? "semantic" : deepLinkKeyword ? "keyword" : null,
  );

  const isSearchMode = activeSearchQuery.trim().length > 0;
  const isSemanticResults = searchKind === "semantic";

  const catalogVideoCount =
    catalogStats?.video_count ?? analytics?.metrics.total_videos ?? 0;
  const headerVideoCount = isSearchMode ? total : catalogVideoCount || total;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, dash, stats] = await Promise.all([
        fetchVideos(100),
        fetchDashboardAnalytics().catch(() => null),
        fetchCatalogStats().catch(() => null),
      ]);
      setVideos(list.videos);
      setTotal(list.total);
      setAnalytics(dash);
      setCatalogStats(stats);
      setDataReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const clearSearch = useCallback(() => {
    setActiveSearchQuery("");
    setSearchKind(null);
    setKeywordInput("");
    setDashboardSearchQuery(null);
    setCollapsed(false);
    const restored =
      catalogStats?.video_count ?? analytics?.metrics.total_videos ?? 0;
    if (restored > 0) {
      setTotal(restored);
    }
    router.replace("/dashboard", { scroll: false });
    void loadData();
  }, [
    analytics?.metrics.total_videos,
    catalogStats?.video_count,
    loadData,
    router,
    setCollapsed,
    setDashboardSearchQuery,
  ]);

  const enterSemanticSearch = useCallback((results: Video[], query: string) => {
    setVideos(results);
    setTotal(results.length);
    setActiveSearchQuery(query);
    setSearchKind("semantic");
    setDashboardSearchQuery(query);
    setCollapsed(true);
    setDataReady(true);
    setError(null);
    setLoading(false);
  }, [setCollapsed, setDashboardSearchQuery]);

  const applyKeywordResults = useCallback(
    (results: Video[], query: string) => {
      setVideos(results);
      setTotal(results.length);
      setActiveSearchQuery(query);
      setSearchKind("keyword");
      setDashboardSearchQuery(query);
      setCollapsed(true);
      setDataReady(true);
    },
    [setCollapsed, setDashboardSearchQuery],
  );

  useEffect(() => {
    void fetchCatalogStats()
      .then(setCatalogStats)
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!deepLinkSemantic && !deepLinkKeyword) {
      void loadData();
    }
  }, [loadData, deepLinkSemantic, deepLinkKeyword]);

  // Deep link keyword search (?q=) — semantic uses SemanticSearchPanel autoRun
  useEffect(() => {
    if (!deepLinkKeyword || deepLinkSemantic) return;
    setLoading(true);
    void searchVideos(deepLinkKeyword)
      .then((r) => applyKeywordResults(r, deepLinkKeyword))
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("dashboard.searchFailed"));
      })
      .finally(() => setLoading(false));
  }, [deepLinkKeyword, deepLinkSemantic, t, applyKeywordResults]);

  const handleKeywordSearch = async () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) {
      clearSearch();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await searchVideos(trimmed);
      applyKeywordResults(results, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.searchFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onComplete = () => {
      if (!isSearchMode) void loadData();
    };
    window.addEventListener(SHEETS_SYNC_COMPLETE_EVENT, onComplete);
    return () =>
      window.removeEventListener(SHEETS_SYNC_COMPLETE_EVENT, onComplete);
  }, [isSearchMode, loadData]);

  const syncing = isActive || isStarting;

  const isEmpty = !loading && !isSearchMode && total === 0;
  const semanticDeepLink = deepLinkSemantic;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title={t("dashboard.title")}
        description={
          !dataReady
            ? t("dashboard.loadingCatalog")
            : isSearchMode
              ? t("dashboard.searchMode.pageDesc", { count: total })
              : t("dashboard.description", { count: headerVideoCount })
        }
        helpKey={isSearchMode ? undefined : "sync"}
        sticky
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/settings"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
              >
                <Settings className="h-4 w-4" />
                {t("dashboard.dataSourceSettings")}
              </Link>
              <SheetsSyncButtons />
            </div>
            {!syncing && <LastSyncBadge lastSync={lastSync} compact />}
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {isEmpty ? (
        <EmptyState
          icon={Sparkles}
          title={t("dashboard.emptyTitle")}
          description={t("dashboard.emptyDesc")}
          prompts={pagePrompts}
          onPrompt={(p) => runExamplePrompt(router, p)}
          links={[
            { label: t("dashboard.setupTutorial"), href: "/welcome" },
            { label: t("dashboard.viewDocsInChat"), href: "/chat" },
          ]}
        />
      ) : isSearchMode ? (
        /* —— Search mode: input → status → results (full width) —— */
        <>
          <div className="sticky top-14 z-20 -mx-4 space-y-3 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SemanticSearchPanel
              compact
              initialQuery={
                searchKind === "semantic" ? activeSearchQuery : keywordInput
              }
              autoRun={Boolean(semanticDeepLink && searchKind === "semantic")}
              transcriptEmbeddingCount={
                catalogStats?.transcript_embedding_count ?? null
              }
              onResults={enterSemanticSearch}
            />
            {searchKind === "keyword" && (
              <div className="flex gap-2">
                <Input
                  placeholder={t("dashboard.searchPlaceholder")}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleKeywordSearch()}
                  aria-label={t("dashboard.keywordSearch")}
                />
                <Button variant="secondary" onClick={() => void handleKeywordSearch()}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            )}
            <DashboardSearchStatus
              query={activeSearchQuery}
              kind={searchKind ?? "semantic"}
              resultCount={total}
              onClear={clearSearch}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("common.videos")}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                {isSemanticResults
                  ? t("dashboard.semanticResults")
                  : t("dashboard.keywordResults")}
                {isSemanticResults && <InfoTip term="semantic_search" />}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <PageSkeleton rows={3} />
              ) : (
                <VideosTable
                  videos={videos}
                  showSimilarity={isSemanticResults}
                  onSelectVideo={(v) => {
                    const base = `/videos/${v.id}`;
                    const q =
                      isSemanticResults && activeSearchQuery.trim()
                        ? `?highlight=${encodeURIComponent(activeSearchQuery.trim())}`
                        : "";
                    router.push(base + q);
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* —— Dashboard mode: exploration —— */
        <>
          <Section title={t("common.quickPrompts")}>
            <PromptChips
              prompts={pagePrompts}
              onSelect={(p) => runExamplePrompt(router, p)}
            />
          </Section>

          <SemanticSearchPanel
            onResults={enterSemanticSearch}
            transcriptEmbeddingCount={catalogStats?.transcript_embedding_count ?? null}
          />

          {analytics && analytics.metrics.total_videos > 0 && (
            <Section
              title={t("dashboard.atAGlance")}
              description={t("dashboard.atAGlanceDesc")}
            >
              <MetricCards
                metrics={analytics.metrics}
                lastSyncSheetRows={lastSync?.sheet_rows}
              />
              <Link href="/analytics" className="text-sm text-primary underline">
                {t("dashboard.fullAnalytics")}
              </Link>
            </Section>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("common.videos")}</CardTitle>
              <div className="space-y-1.5">
                <CardDescription>{t("dashboard.keywordSearch")}</CardDescription>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("dashboard.keywordSearchDesc")}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t("dashboard.searchPlaceholder")}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleKeywordSearch()}
                />
                <Button variant="secondary" onClick={() => void handleKeywordSearch()}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {loading ? (
                <PageSkeleton rows={2} />
              ) : (
                <VideosTable
                  videos={videos}
                  onSelectVideo={(v) => router.push(`/videos/${v.id}`)}
                />
              )}
            </CardContent>
          </Card>

          <DashboardResearch />
        </>
      )}
    </div>
  );
}
