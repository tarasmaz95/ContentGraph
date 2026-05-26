"use client";

import Link from "next/link";

import type { SmartInsight } from "@/types/copilot";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

const KNOWN_HOOKS = new Set([
  "identity",
  "authority",
  "contrarian",
  "curiosity",
  "numbers",
  "how_to",
  "general",
  "urgency",
  "transformation",
]);

function formatNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function buildInsightExplanation(
  insight: SmartInsight,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  const hook = insight.hook_type?.toLowerCase();

  if (hook && insight.outperform_pct != null && insight.avg_views != null) {
    const typeHint = KNOWN_HOOKS.has(hook)
      ? t(`copilot.smartInsights.hook.${hook}`)
      : t("copilot.smartInsights.hook.generic", { hook });
    return [
      typeHint,
      t("copilot.smartInsights.hookStats", {
        pct: insight.outperform_pct,
        avg: formatNum(insight.avg_views),
        baseline: formatNum(insight.baseline_avg_views),
        count: insight.pattern_count ?? 0,
      }),
    ].join(" ");
  }

  if (hook === "curiosity" && insight.avg_views != null) {
    return [
      t("copilot.smartInsights.hook.curiosity"),
      t("copilot.smartInsights.curiosityStats", {
        avg: formatNum(insight.avg_views),
        baseline: formatNum(insight.baseline_avg_views),
        count: insight.pattern_count ?? 0,
      }),
    ].join(" ");
  }

  if (insight.creator_name && insight.outperform_pct != null) {
    return t("copilot.smartInsights.creatorStrong", {
      name: insight.creator_name,
      pct: insight.outperform_pct,
    });
  }

  if (insight.creator_name && insight.hook_type && insight.avg_views != null) {
    return t("copilot.smartInsights.creatorHookLead", {
      name: insight.creator_name,
      hook: insight.hook_type,
      avg: formatNum(insight.avg_views),
      count: insight.pattern_count ?? 0,
    });
  }

  if (insight.topic && insight.id === "trend-topic") {
    return t("copilot.smartInsights.trendTopic", { topic: insight.topic });
  }

  if (insight.keyword) {
    return t("copilot.smartInsights.trendKeyword", {
      keyword: insight.keyword,
      count: insight.keyword_video_count ?? 0,
    });
  }

  if (insight.topic && insight.category === "audience") {
    return t("copilot.smartInsights.audienceTopic", { topic: insight.topic });
  }

  if (insight.category === "audience") return t("copilot.smartInsights.audience");

  if (insight.hook_type && insight.category === "video") {
    return t("copilot.smartInsights.videoHook", { hook: insight.hook_type });
  }

  return null;
}

function buildLiveExamples(
  insights: SmartInsight[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string[] {
  const lines: string[] = [];
  for (const insight of insights) {
    if (insight.hook_type && insight.outperform_pct != null && insight.avg_views != null) {
      lines.push(
        t("copilot.smartInsights.liveHookExample", {
          hook: insight.hook_type,
          pct: insight.outperform_pct,
          avg: formatNum(insight.avg_views),
        }),
      );
    } else if (insight.topic && insight.id === "trend-topic") {
      lines.push(t("copilot.smartInsights.liveTopicExample", { topic: insight.topic }));
    } else if (insight.keyword) {
      lines.push(
        t("copilot.smartInsights.liveKeywordExample", {
          keyword: insight.keyword,
          count: insight.keyword_video_count ?? 0,
        }),
      );
    }
  }
  return lines;
}

interface SmartInsightsSectionProps {
  insights: SmartInsight[];
  catalogVideoCount: number;
  hookPatternsCount: number;
  analyticsSampleSize: number;
}

/** Smart Insights — explanations and examples driven by live API metadata. */
export function SmartInsightsSection({
  insights,
  catalogVideoCount,
  hookPatternsCount,
  analyticsSampleSize,
}: SmartInsightsSectionProps) {
  const t = useT();
  const liveExamples = buildLiveExamples(insights, t);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
          {t("copilot.smartInsights.title")}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("copilot.smartInsights.introDynamic", {
            catalog: catalogVideoCount,
            hooks: hookPatternsCount,
            sample: analyticsSampleSize,
          })}
        </p>
      </div>

      <ul className="space-y-3">
        {insights.map((insight) => {
          const explain = buildInsightExplanation(insight, t);

          const card = (
            <div className="space-y-1.5">
              <p className="font-medium leading-snug">{insight.text}</p>
              {explain && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{explain}</p>
              )}
            </div>
          );

          return (
            <li key={insight.id}>
              {insight.href ? (
                <Link
                  href={insight.href}
                  className="block rounded-md border bg-background p-2.5 text-xs hover:border-primary/40"
                >
                  <span
                    className={cn(
                      "mb-1.5 mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle",
                      PRIORITY_DOT[insight.priority] ?? PRIORITY_DOT.medium,
                    )}
                  />
                  {card}
                </Link>
              ) : (
                <div className="rounded-md border bg-background p-2.5 text-xs">{card}</div>
              )}
            </li>
          );
        })}
      </ul>

      {liveExamples.length > 0 && (
        <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2.5 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
          <p className="font-semibold text-foreground text-xs">
            {t("copilot.smartInsights.examplesTitle")}
          </p>
          {liveExamples.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </section>
  );
}
