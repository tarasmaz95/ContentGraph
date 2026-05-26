"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CommentCharts } from "@/types/video-intelligence";
import type { ChartPoint } from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#94a3b8",
  negative: "#ef4444",
};

interface CommentChartsPanelProps {
  charts: CommentCharts;
}

/** Comments analytics — sentiment, emotions, questions, phrases */
export function CommentChartsPanel({ charts }: CommentChartsPanelProps) {
  const sentimentData = charts.sentiment_distribution.map((d) => ({
    name: d.label,
    value: d.count,
    fill: SENTIMENT_COLORS[d.label] ?? "#6366f1",
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Positive vs Negative Sentiment</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {sentimentData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments to chart.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {sentimentData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <BarChartCard title="Emotional Triggers" data={charts.emotional_triggers} />
      <BarChartCard title="Audience Question Frequency" data={charts.question_frequency} />
      <BarChartCard title="Top Recurring Phrases" data={charts.recurring_phrases} />
    </div>
  );
}

function BarChartCard({ title, data }: { title: string; data: ChartPoint[] }) {
  const chartData = data.map((d) => ({
    name: d.label.length > 14 ? `${d.label.slice(0, 12)}…` : d.label,
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough comment data.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
