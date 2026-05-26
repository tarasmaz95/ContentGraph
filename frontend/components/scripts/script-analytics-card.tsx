"use client";

import { useT } from "@/lib/i18n";
import type { ScriptAnalytics } from "@/types/scripts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ScriptAnalyticsCardProps {
  analytics: ScriptAnalytics;
}

/** Explainable script quality scores */
export function ScriptAnalyticsCard({ analytics }: ScriptAnalyticsCardProps) {
  const t = useT();

  const metrics = [
    { label: t("scripts.metricEngagement"), value: analytics.estimated_engagement },
    { label: t("scripts.metricHook"), value: analytics.hook_strength },
    { label: t("scripts.metricSimilarity"), value: analytics.creator_similarity },
    { label: t("scripts.metricReadability"), value: analytics.readability },
  ];

  return (
    <Card className="border-primary/10">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-base">{t("scripts.analyticsTitle")}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {t("scripts.analyticsHow")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-semibold tabular-nums">{m.value}%</p>
            </div>
          ))}
        </div>
        {analytics.emotional_triggers.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("scripts.metricTriggers")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {analytics.emotional_triggers.map((tr) => (
                <span key={tr} className="rounded bg-primary/10 px-2 py-0.5 text-xs">
                  {tr}
                </span>
              ))}
            </div>
          </div>
        )}
        {analytics.notes && (
          <p className="text-xs text-muted-foreground">{analytics.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
