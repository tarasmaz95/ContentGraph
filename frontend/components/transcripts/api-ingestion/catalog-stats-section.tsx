"use client";

import { useT } from "@/lib/i18n";
import type { CatalogCoverageStats } from "@/types/transcript-api-ingestion";

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function CatalogStatsSection({ catalog }: { catalog: CatalogCoverageStats }) {
  const t = useT();

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("transcriptApiIngestion.catalogSection")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("transcriptApiIngestion.statsTotal")} value={catalog.total_videos} />
        <StatTile
          label={t("transcriptApiIngestion.statsWith")}
          value={catalog.with_transcript}
          sub={`${catalog.transcript_coverage_pct}%`}
        />
        <StatTile
          label={t("transcriptApiIngestion.statsWithout")}
          value={catalog.without_transcript}
        />
        <StatTile
          label={t("transcriptApiIngestion.statsEmbeddings")}
          value={catalog.with_transcript_embedding}
          sub={`${catalog.embedding_coverage_pct}% ${t("transcriptApiIngestion.ofTranscripts")}`}
        />
      </div>
    </section>
  );
}
