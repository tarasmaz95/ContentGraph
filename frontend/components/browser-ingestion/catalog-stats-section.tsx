"use client";

import { useT } from "@/lib/i18n";
import type { BrowserIngestionDashboard } from "@/types/browser-ingestion";

export function BrowserCatalogStatsSection({
  dashboard,
}: {
  dashboard: Pick<
    BrowserIngestionDashboard,
    "catalog_videos_total" | "catalog_missing_transcript" | "catalog_missing_comments"
  >;
}) {
  const t = useT();

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("browserIngestion.catalogSection")}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatTile label={t("browserIngestion.statsTotal")} value={dashboard.catalog_videos_total} />
        <StatTile
          label={t("browserIngestion.statsMissingTranscript")}
          value={dashboard.catalog_missing_transcript}
        />
        <StatTile
          label={t("browserIngestion.statsMissingComments")}
          value={dashboard.catalog_missing_comments}
        />
      </div>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
