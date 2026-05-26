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

import type { VideoCharts } from "@/types/video-intelligence";
import type { ChartPoint } from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoChartsProps {
  charts: VideoCharts;
}

/** Per-video Recharts — topics, emotions, structure, keywords */
export function VideoChartsPanel({ charts }: VideoChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Transcript Topic Frequency" data={charts.topic_frequency} />
      <ChartCard title="Emotional Triggers" data={charts.emotional_distribution} dataKey="count" />
      <ChartCard title="Structure Timeline (%)" data={charts.structure_timeline} dataKey="value" />
      <ChartCard title="Keyword Frequency" data={charts.keyword_frequency} dataKey="count" />
    </div>
  );
}

function ChartCard({
  title,
  data,
  dataKey = "value",
}: {
  title: string;
  data: ChartPoint[];
  dataKey?: string;
}) {
  const chartData = data.map((d) => ({
    name: d.label.length > 12 ? `${d.label.slice(0, 10)}…` : d.label,
    value: d.value,
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transcript data for chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey={dataKey} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
