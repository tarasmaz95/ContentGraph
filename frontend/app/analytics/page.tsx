"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { AnalyticsCharts } from "@/components/analytics/charts";
import { GrowthTrends } from "@/components/analytics/growth-trends";
import { InsightCards } from "@/components/analytics/insight-cards";
import { MetricCards } from "@/components/analytics/metric-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { ANALYTICS_CHARTS_SAMPLE_SIZE, fetchDashboardAnalytics } from "@/services/api";
import type { DashboardAnalytics } from "@/types/analytics";

/**
 * Analytics page — structured insights, metrics, and Recharts visualizations.
 */
export default function AnalyticsPage() {
  const t = useT();
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const analytics = await fetchDashboardAnalytics(ANALYTICS_CHARTS_SAMPLE_SIZE);
      setData(analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("analytics.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? t("common.noData")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("analytics.description")}</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          {t("common.refresh")}
        </Button>
      </div>

      <MetricCards metrics={data.metrics} />
      <InsightCards data={data} />

      <GrowthTrends />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("common.charts")}</h2>
        <AnalyticsCharts charts={data.charts} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={t("analytics.hookAnalytics")}
          description={t("analytics.hookAnalyticsDesc")}
          emptyMessage={t("analytics.syncFirst")}
          items={[
            ...data.hook_analysis.top_hooks.map((h) =>
              t("analytics.hookLabel", { hook: h }),
            ),
            ...data.hook_analysis.recommendations,
          ]}
        />
        <SectionCard
          title={t("analytics.creatorInsights")}
          description={t("analytics.creatorInsightsDesc")}
          emptyMessage={t("analytics.syncFirst")}
          items={data.top_creators.map((c) =>
            t("analytics.creatorAvg", {
              name: c.creator_name,
              views: c.avg_views.toLocaleString(),
            }),
          )}
        />
        <SectionCard
          title={t("analytics.viralPatterns")}
          description={t("analytics.viralPatternsDesc")}
          emptyMessage={t("analytics.syncFirst")}
          items={data.trend_analysis.viral_patterns}
        />
        <SectionCard
          title={t("analytics.topicTrends")}
          description={t("analytics.topicTrendsDesc")}
          emptyMessage={t("analytics.syncFirst")}
          items={data.trending_topics}
        />
        <SectionCard
          title={t("analytics.titleStructures")}
          description={t("analytics.titleStructuresDesc")}
          emptyMessage={t("analytics.syncFirst")}
          items={[
            ...data.title_analysis.common_structures,
            ...data.title_analysis.recommendations,
          ]}
          className="lg:col-span-2"
        />
      </section>

      <p className="text-center text-sm text-muted-foreground">
        {t("analytics.wantAi")}{" "}
        <Link href="/chat" className="text-primary underline">
          {t("analytics.openAiChat")}
        </Link>
      </p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  items,
  emptyMessage,
  className,
}: {
  title: string;
  description: string;
  items: string[];
  emptyMessage: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {items.length === 0 ? (
            <li className="text-muted-foreground">{emptyMessage}</li>
          ) : (
            items.map((item) => (
              <li key={item} className="rounded bg-muted/40 px-2 py-1">
                {item}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
