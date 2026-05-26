"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";

import { useCopilotContext } from "@/components/copilot/copilot-context";
import { BriefCard } from "@/components/copilot/brief-card";
import { SmartInsightsSection } from "@/components/copilot/smart-insights-section";
import { fetchCopilotPanel } from "@/services/api";
import type { CopilotPanelResponse } from "@/types/copilot";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Persistent AI Copilot sidebar — proactive insights and recommendations.
 */
export function CopilotPanel() {
  const {
    context,
    creatorName,
    videoId,
    dashboardSearchQuery,
    collapsed,
    setCollapsed,
  } = useCopilotContext();
  const t = useT();
  const hideTrendBrief =
    (context === "dashboard" && Boolean(dashboardSearchQuery?.trim())) ||
    context === "feed" ||
    context === "compare";
  const [data, setData] = useState<CopilotPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await fetchCopilotPanel({
          context,
          creatorName: creatorName ?? undefined,
          videoId: videoId ?? undefined,
        }),
      );
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [context, creatorName, videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (collapsed) {
    return (
      <aside className="hidden w-10 shrink-0 border-l bg-card lg:block">
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 w-full px-0"
          onClick={() => setCollapsed(false)}
          aria-label="Open AI Copilot"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "hidden w-80 shrink-0 flex-col border-l bg-card lg:flex",
        "max-h-[calc(100vh-3.5rem)] sticky top-14",
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Copilot</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-2"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse copilot"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {context === "dashboard" && hideTrendBrief && dashboardSearchQuery && (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            Search mode: trends for &ldquo;{dashboardSearchQuery}&rdquo; are in
            your results. Clear search to see catalog-wide trend brief.
          </p>
        )}

        {context === "feed" && !loading && (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            {t("feed.copilotSidebarNote")}
          </p>
        )}

        {!loading && data?.brief && !hideTrendBrief && <BriefCard brief={data.brief} />}

        {!loading && data && data.smart_insights.length > 0 && (
          <SmartInsightsSection
            insights={data.smart_insights}
            catalogVideoCount={data.catalog_video_count}
            hookPatternsCount={data.hook_patterns_count}
            analyticsSampleSize={data.analytics_sample_size}
          />
        )}

        {!loading &&
          data &&
          data.recommendations.filter(
            (rec) => context !== "feed" || rec.href !== "/feed",
          ).length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Recommended
            </h3>
            <ul className="space-y-2">
              {data.recommendations
                .filter((rec) => context !== "feed" || rec.href !== "/feed")
                .map((rec) => (
                <li key={`${rec.href}-${rec.label}`}>
                  <Link
                    href={rec.href}
                    className="block rounded-md border p-2 text-xs hover:bg-muted/50"
                  >
                    <p className="font-medium text-primary">{rec.label}</p>
                    <p className="mt-0.5 text-muted-foreground line-clamp-2">
                      {rec.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {context !== "feed" && (
          <Link
            href="/feed"
            className="block rounded-md border border-dashed p-2 text-center text-xs text-primary hover:bg-primary/5"
          >
            Open Intelligence Feed →
          </Link>
        )}
      </div>
    </aside>
  );
}
