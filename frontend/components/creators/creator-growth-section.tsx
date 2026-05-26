"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CreatorGrowthIntel } from "@/types/creator-intelligence";
import type { ChartPoint } from "@/types/creator-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export function CreatorGrowthSection({ growth }: { growth: CreatorGrowthIntel }) {
  const t = useT();
  const m = growth.metrics;
  const hasHistory = growth.subscriber_history.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("creators.growth7d")} value={`${m.growth_7d_pct.toFixed(1)}%`} />
        <Metric
          label={t("creators.subsDelta7d")}
          value={m.subscribers_delta_7d.toLocaleString()}
        />
        <Metric
          label={t("creators.velocity")}
          value={m.velocity_views_per_day.toLocaleString()}
        />
        <Metric
          label={t("creators.momentum")}
          value={
            m.accelerating
              ? t("creators.accelerating")
              : m.slowing
                ? t("creators.slowing")
                : t("creators.steady")
          }
        />
      </div>

      {!hasHistory ? (
        <p className="text-sm text-muted-foreground">{t("creators.growthEmpty")}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <GrowthChart title={t("creators.subscriberGrowth")} data={growth.subscriber_history} />
          <GrowthChart title={t("creators.viewsGrowth")} data={growth.views_history} />
          <GrowthChart title={t("creators.uploadMomentum")} data={growth.upload_momentum} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function GrowthChart({ title, data }: { title: string; data: ChartPoint[] }) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">Need 2+ daily snapshots</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [Number(v).toLocaleString(), ""]} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
