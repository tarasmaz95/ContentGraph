"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PromptChips } from "@/components/ui/prompt-chips";
import { InfoTip } from "@/components/ui/info-tip";
import { SEMANTIC_INPUT_ID } from "@/components/convenience/keyboard-shortcuts";
import { SavedSearchesChips } from "@/components/convenience/saved-searches-chips";
import { getPagePrompts, useLocale, useT } from "@/lib/i18n";
import { semanticSearchVideos } from "@/services/api";
import { trackSearch } from "@/lib/personalization";
import type { Video } from "@/types/video";

interface SemanticSearchPanelProps {
  onResults: (videos: Video[], query: string) => void;
  /** Compact sticky bar for search-focused dashboard mode */
  compact?: boolean;
  /** Pre-fill and optionally auto-run (deep links) */
  initialQuery?: string;
  autoRun?: boolean;
  /** When 0, UI copy reflects title-only semantic search */
  transcriptEmbeddingCount?: number | null;
}

/** AI Search — natural language queries via pgvector embeddings. */
export function SemanticSearchPanel({
  onResults,
  compact = false,
  initialQuery = "",
  autoRun = false,
  transcriptEmbeddingCount = null,
}: SemanticSearchPanelProps) {
  const t = useT();
  const { locale } = useLocale();
  const semanticPrompts = getPagePrompts(locale).semantic;
  const titleOnlySearch =
    transcriptEmbeddingCount === null || transcriptEmbeddingCount === 0;
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (autoRun && initialQuery.trim()) {
      void runSearch(initialQuery);
    }
    // Only on mount / deep-link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setLoading(true);
    setError(null);
    trackSearch(trimmed);

    try {
      const results = await semanticSearchVideos(trimmed, 50);
      onResults(results, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("videos.semanticFailed"));
    } finally {
      setLoading(false);
    }
  };

  const searchRow = (
    <div className="space-y-2">
      <div className="flex gap-2">
      <Input
        id={SEMANTIC_INPUT_ID}
        placeholder={t("videos.semanticPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void runSearch(query)}
        disabled={loading}
        className={compact ? "h-10" : undefined}
        aria-label={t("videos.aiSearch")}
      />
      <Button onClick={() => void runSearch(query)} disabled={loading || !query.trim()}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
          {t("common.search")}
        </span>
      </Button>
      </div>
      <SavedSearchesChips
        currentSemanticQuery={query}
        onRunSemantic={(q) => void runSearch(q)}
      />
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">{t("videos.aiSearch")}</span>
          <InfoTip term="semantic_search" />
        </div>
        {searchRow}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("videos.aiSearch")}
        </CardTitle>
        <div className="space-y-1.5">
          <CardDescription className="flex items-center gap-1">
            {titleOnlySearch
              ? t("videos.semanticDescTitleOnly")
              : t("videos.semanticDesc")}
            <InfoTip term="semantic_search" />
          </CardDescription>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {titleOnlySearch
              ? t("videos.semanticSearchHowTitleOnly")
              : t("videos.semanticSearchHow")}
          </p>
          <p className="rounded-md border border-primary/15 bg-background/80 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            {t("videos.semanticSearchExample")}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PromptChips
          prompts={semanticPrompts}
          onSelect={(p) => void runSearch(p.text)}
          disabled={loading}
        />
        {searchRow}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
