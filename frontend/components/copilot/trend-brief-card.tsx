"use client";

import type { AIBrief } from "@/types/copilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

interface TrendBriefCardProps {
  brief: AIBrief;
}

type TrendField = "topics" | "keywords" | "hooks" | "avgViews" | "other";

function parseTrendBullet(line: string): { field: TrendField; value: string } {
  if (line.startsWith("Topics:")) return { field: "topics", value: line.slice(7).trim() };
  if (line.startsWith("Keywords:")) return { field: "keywords", value: line.slice(9).trim() };
  if (line.startsWith("Top hook types:")) {
    return { field: "hooks", value: line.slice(15).trim() };
  }
  if (line.startsWith("Avg views:")) return { field: "avgViews", value: line.slice(10).trim() };
  return { field: "other", value: line };
}

const FIELD_LABEL: Record<Exclude<TrendField, "other">, string> = {
  topics: "copilot.trendBrief.topicsLabel",
  keywords: "copilot.trendBrief.keywordsLabel",
  hooks: "copilot.trendBrief.hooksLabel",
  avgViews: "copilot.trendBrief.avgViewsLabel",
};

const FIELD_EXPLAIN: Record<Exclude<TrendField, "other">, string> = {
  topics: "copilot.trendBrief.topicsExplain",
  keywords: "copilot.trendBrief.keywordsExplain",
  hooks: "copilot.trendBrief.hooksExplain",
  avgViews: "copilot.trendBrief.avgViewsExplain",
};

/** Catalog trend brief with per-field explanations (Topics, Keywords, …). */
export function TrendBriefCard({ brief }: TrendBriefCardProps) {
  const t = useT();

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          {t("copilot.trendBrief.typeLabel")}
        </p>
        <CardTitle className="text-sm leading-snug">{brief.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{brief.headline}</p>
        <p className="rounded-md border border-primary/15 bg-background/80 px-2.5 py-2 text-xs text-muted-foreground leading-relaxed">
          {t("copilot.trendBrief.sampleNote", {
            catalog: brief.catalog_total ?? "—",
            sample: brief.sample_size ?? "—",
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {brief.bullets.map((line) => {
          const { field, value } = parseTrendBullet(line);
          if (field === "other") {
            return (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            );
          }
          return (
            <div key={field} className="space-y-1">
              <p className="font-semibold text-foreground">{t(FIELD_LABEL[field])}</p>
              <p className="font-medium tabular-nums text-primary">{value}</p>
              <p className="text-muted-foreground leading-relaxed">
                {field === "avgViews"
                  ? t("copilot.trendBrief.avgViewsExplain", {
                      sample: brief.sample_size ?? "—",
                      catalog: brief.catalog_total ?? "—",
                    })
                  : field === "topics" && value
                    ? t("copilot.trendBrief.topicsExplainDynamic", {
                        words: value,
                        sample: brief.sample_size ?? "—",
                      })
                    : t(FIELD_EXPLAIN[field])}
              </p>
            </div>
          );
        })}

        {brief.actions.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="font-semibold text-muted-foreground">{t("copilot.trendBrief.actionsLabel")}</p>
            <p className="text-muted-foreground leading-relaxed">
              {t("copilot.trendBrief.actionsExplain")}
            </p>
            <ul className="space-y-1">
              {brief.actions.map((action) => (
                <li key={action} className="rounded bg-background/80 px-2 py-1">
                  → {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
