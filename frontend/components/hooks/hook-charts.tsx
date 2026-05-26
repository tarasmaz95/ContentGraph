"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useLocale, useT } from "@/lib/i18n";
import type { HookCharts as HookChartsType } from "@/types/hooks";
import type { ChartPoint } from "@/types/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface HookChartsProps {
  charts: HookChartsType;
}

type ChartKey = "typeDist" | "avgViews" | "creatorEff" | "triggers";

const CHART_CONFIG: {
  key: ChartKey;
  dataKey: keyof HookChartsType;
  barKey: "count" | "value";
  yLabelKey: "hooks.chartYCount" | "hooks.chartYAvgViews" | "hooks.chartYEffectiveness";
}[] = [
  {
    key: "typeDist",
    dataKey: "hook_type_distribution",
    barKey: "count",
    yLabelKey: "hooks.chartYCount",
  },
  {
    key: "avgViews",
    dataKey: "avg_views_by_type",
    barKey: "value",
    yLabelKey: "hooks.chartYAvgViews",
  },
  {
    key: "creatorEff",
    dataKey: "creator_hook_comparison",
    barKey: "value",
    yLabelKey: "hooks.chartYEffectiveness",
  },
  {
    key: "triggers",
    dataKey: "emotional_trigger_frequency",
    barKey: "count",
    yLabelKey: "hooks.chartYCount",
  },
];

const TITLE_KEYS: Record<ChartKey, "hooks.chartTypeDistTitle" | "hooks.chartAvgViewsTitle" | "hooks.chartCreatorEffTitle" | "hooks.chartTriggersTitle"> = {
  typeDist: "hooks.chartTypeDistTitle",
  avgViews: "hooks.chartAvgViewsTitle",
  creatorEff: "hooks.chartCreatorEffTitle",
  triggers: "hooks.chartTriggersTitle",
};

const DESC_KEYS: Record<ChartKey, "hooks.chartTypeDistDesc" | "hooks.chartAvgViewsDesc" | "hooks.chartCreatorEffDesc" | "hooks.chartTriggersDesc"> = {
  typeDist: "hooks.chartTypeDistDesc",
  avgViews: "hooks.chartAvgViewsDesc",
  creatorEff: "hooks.chartCreatorEffDesc",
  triggers: "hooks.chartTriggersDesc",
};

/** Hook Intelligence charts — distribution, views, creators, triggers */
export function HookCharts({ charts }: HookChartsProps) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm space-y-1">
        <p className="text-muted-foreground leading-relaxed">{t("hooks.chartsSectionIntro")}</p>
        {locale === "uk" && (
          <p className="text-xs text-muted-foreground/90 border-l-2 border-primary/30 pl-3 leading-relaxed">
            {t("hooks.chartsSectionIntroEn")}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {CHART_CONFIG.map((cfg) => (
          <BarCard
            key={cfg.key}
            title={t(TITLE_KEYS[cfg.key])}
            description={t(DESC_KEYS[cfg.key])}
            data={charts[cfg.dataKey]}
            barKey={cfg.barKey}
            yLabel={t(cfg.yLabelKey)}
            emptyLabel={t("hooks.chartEmpty")}
          />
        ))}
      </div>
    </div>
  );
}

function BarCard({
  title,
  description,
  data,
  barKey,
  yLabel,
  emptyLabel,
}: {
  title: string;
  description: string;
  data: ChartPoint[];
  barKey: "count" | "value";
  yLabel: string;
  emptyLabel: string;
}) {
  const chartData = data.map((d) => ({
    name: d.label.length > 14 ? `${d.label.slice(0, 12)}…` : d.label,
    count: d.count,
    value: d.value,
  }));

  return (
    <Card className="border-primary/10">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-22} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [Number(v).toLocaleString(), yLabel]}
              />
              <Legend />
              <Bar dataKey={barKey} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={yLabel} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
