"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CreatorCharts as CreatorChartsType } from "@/types/creator-page";
import type { ChartPoint } from "@/types/creator-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CreatorChartsProps {
  charts: CreatorChartsType;
}

/** Creator-scoped Recharts — views, hooks, keywords, uploads */
export function CreatorCharts({ charts }: CreatorChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LineChartCard title="Views Over Time (avg per month)" data={charts.views_over_time} />
      <BarChartCard title="Upload Frequency" data={charts.upload_frequency} dataKey="count" />
      <BarChartCard title="Hook Distribution (avg views)" data={charts.hook_distribution} />
      <BarChartCard title="Keyword Frequency" data={charts.keyword_frequency} dataKey="count" />
      <BarChartCard
        title="Title Length vs Avg Views"
        data={charts.title_length_vs_views}
        className="lg:col-span-2"
      />
    </div>
  );
}

function LineChartCard({ title, data }: { title: string; data: ChartPoint[] }) {
  const chartData = data.map((d) => ({
    name: d.label,
    value: d.value,
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {chartData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [Number(v).toLocaleString(), "Avg views"]} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Avg views"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function BarChartCard({
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
    name: d.label.length > 16 ? `${d.label.slice(0, 14)}…` : d.label,
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
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [Number(v).toLocaleString(), "Value"]} />
              <Legend />
              <Bar
                dataKey={dataKey}
                fill="hsl(var(--primary))"
                name={dataKey === "count" ? "Count" : "Avg views"}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <p className="text-sm text-muted-foreground">No chart data — sync videos with dates.</p>;
}
