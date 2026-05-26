"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { fetchResearchSummary } from "@/services/api";
import type { ResearchSummary } from "@/types/research";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Dashboard block: recent insights, creator findings, comparisons */
export function DashboardResearch() {
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResearchSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || (summary.total_insights === 0 && summary.total_notes === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Research</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Save insights from{" "}
          <Link href="/chat" className="text-primary underline">
            AI Chat
          </Link>{" "}
          or{" "}
          <Link href="/creators" className="text-primary underline">
            Creators
          </Link>{" "}
          to build your workspace.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Research Workspace</h2>
        <Link href="/research" className="text-sm text-primary underline">
          Open research →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MiniList title="Recent Insights" items={summary.recent_insights.map((i) => i.insight_text)} />
        <MiniList title="Creator Findings" items={summary.creator_findings.map((i) => i.insight_text)} />
        <MiniList title="Comparisons" items={summary.saved_comparisons.map((i) => i.insight_text)} />
      </div>
    </section>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {items.slice(0, 4).map((text, idx) => (
              <li key={idx} className="line-clamp-2 text-muted-foreground">
                {text}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
