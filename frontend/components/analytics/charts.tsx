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

import type { ChartPoint, DashboardCharts } from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalyticsChartsProps {
  charts: DashboardCharts;
}

/** Recharts visualizations for the analytics page */
export function AnalyticsCharts({ charts }: AnalyticsChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Views Distribution" data={charts.views_distribution} dataKey="count" />
      <ChartCard title="Keyword Frequency" data={charts.keyword_frequency} dataKey="value" />
      <ChartCard title="Creator Comparison (Avg Views)" data={charts.creator_comparison} />
      <ChartCard title="Hook Type Distribution" data={charts.hook_type_distribution} />
      <ChartCard
        title="Title Length vs Avg Views"
        data={charts.title_length_vs_views}
        className="lg:col-span-2"
      />
    </div>
  );
}

function ChartCard({
  title,
  data,
  dataKey = "value",
  className,
}: {
  title: string;
  data: ChartPoint[];
  dataKey?: string;
  className?: string;
}) {
  const chartData = data.map((d) => ({
    name: d.label.length > 18 ? `${d.label.slice(0, 16)}…` : d.label,
    fullLabel: d.label,
    value: d.value,
    count: d.count,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chart data — sync videos first.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [Number(value).toLocaleString(), "Value"]}
              />
              <Legend />
              <Bar dataKey={dataKey} fill="hsl(var(--primary))" name={dataKey === "count" ? "Count" : "Value"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
