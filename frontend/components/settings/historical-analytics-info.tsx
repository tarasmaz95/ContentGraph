"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";

import { SnapshotStatusBlock } from "@/components/settings/snapshot-status-block";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

interface HistoricalAnalyticsInfoCardProps {
  onToast: (message: string, variant: "success" | "error") => void;
}

/**
 * Internal explainer + snapshot cron monitoring (no scheduler admin).
 */
export function HistoricalAnalyticsInfoCard({ onToast }: HistoricalAnalyticsInfoCardProps) {
  const t = useT();

  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t("settings.historicalAnalytics.title")}
        </CardTitle>
        <CardDescription>{t("settings.historicalAnalytics.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <SnapshotStatusBlock onToast={onToast} />
        <section>
          <h3 className="mb-1 font-medium text-foreground">
            {t("settings.historicalAnalytics.cronTitle")}
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("settings.historicalAnalytics.cron1")}</li>
            <li>{t("settings.historicalAnalytics.cron2")}</li>
            <li>{t("settings.historicalAnalytics.cron3")}</li>
          </ul>
        </section>

        <section>
          <h3 className="mb-1 font-medium text-foreground">
            {t("settings.historicalAnalytics.trackedTitle")}
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("settings.historicalAnalytics.tracked1")}</li>
            <li>{t("settings.historicalAnalytics.tracked2")}</li>
            <li>{t("settings.historicalAnalytics.tracked3")}</li>
            <li>{t("settings.historicalAnalytics.tracked4")}</li>
          </ul>
        </section>

        <section className="rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <h3 className="mb-1 font-medium">{t("settings.historicalAnalytics.limitTitle")}</h3>
          <p className="text-xs leading-relaxed">{t("settings.historicalAnalytics.limitBody")}</p>
        </section>

        <section>
          <h3 className="mb-1 font-medium text-foreground">
            {t("settings.historicalAnalytics.growthTitle")}
          </h3>
          <p className="text-xs leading-relaxed">{t("settings.historicalAnalytics.growthBody")}</p>
        </section>

        <pre
          className="overflow-x-auto rounded-md border bg-background/80 p-3 font-mono text-[11px] leading-relaxed text-foreground"
          aria-label={t("settings.historicalAnalytics.flowTitle")}
        >
          {t("settings.historicalAnalytics.flowDiagram")}
        </pre>

        <p className="text-xs">{t("settings.historicalAnalytics.footer")}</p>
      </CardContent>
    </Card>
  );
}
