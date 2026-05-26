import type { AnalyticsMetrics } from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

interface MetricCardsProps {
  metrics: AnalyticsMetrics;
  /** Rows processed from Google Sheets on the last sync (may exceed unique catalog videos). */
  lastSyncSheetRows?: number | null;
}

/** Summary stat cards — catalog-wide metrics from /analytics/dashboard. */
export function MetricCards({ metrics, lastSyncSheetRows }: MetricCardsProps) {
  const t = useT();

  const sheetRowsSub =
    lastSyncSheetRows != null && lastSyncSheetRows > 0
      ? t("dashboard.metricSheetRowsSub", {
          count: lastSyncSheetRows.toLocaleString(),
        })
      : undefined;

  const cards: {
    key: string;
    label: string;
    value: string;
    subValue?: string;
  }[] = [
    {
      key: "total",
      label: t("dashboard.metricTotalVideos"),
      value: metrics.total_videos.toLocaleString(),
      subValue: sheetRowsSub,
    },
    {
      key: "avgViews",
      label: t("dashboard.metricAvgViews"),
      value: metrics.avg_views.toLocaleString(),
    },
    {
      key: "medianViews",
      label: t("dashboard.metricMedianViews"),
      value: metrics.median_views.toLocaleString(),
    },
    {
      key: "maxViews",
      label: t("dashboard.metricMaxViews"),
      value: metrics.max_views.toLocaleString(),
    },
    {
      key: "titleLength",
      label: t("dashboard.metricAvgTitleLength"),
      value: t("dashboard.metricTitleLengthValue", { n: metrics.avg_title_length }),
    },
    {
      key: "numbers",
      label: t("dashboard.metricTitlesWithNumbers"),
      value: `${metrics.titles_with_numbers_pct}%`,
    },
    {
      key: "howTo",
      label: t("dashboard.metricHowToTitles"),
      value: `${metrics.how_to_titles_pct}%`,
    },
    {
      key: "curiosity",
      label: t("dashboard.metricCuriosityHooks"),
      value: `${metrics.curiosity_titles_pct}%`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold tabular-nums">{card.value}</p>
            {card.subValue && (
              <p className="text-xs leading-snug text-muted-foreground">
                {card.subValue}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
