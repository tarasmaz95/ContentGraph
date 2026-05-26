"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { QuickCompare } from "@/components/convenience/quick-compare";
import { SaveResearchButton } from "@/components/research/save-research-button";
import type { CuratedInsight } from "@/lib/feed-curate";
import { useT } from "@/lib/i18n";

interface FeedInsightCardProps {
  insight: CuratedInsight;
}

export function FeedInsightCard({ insight }: FeedInsightCardProps) {
  const t = useT();
  const { source: item } = insight;

  return (
    <article className="group flex h-full flex-col rounded-xl border border-border/80 bg-card/50 p-5 shadow-sm transition-colors hover:border-primary/25 hover:bg-card">
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {item.badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {item.badge}
            </span>
          )}
          {insight.timeWindow && <span>{insight.timeWindow}</span>}
          {insight.evidenceCount != null && insight.evidenceCount > 0 && (
            <span className="tabular-nums">
              {t("feed.evidenceCount", { count: insight.evidenceCount })}
            </span>
          )}
        </div>

        <h4 className="text-[15px] font-semibold leading-snug text-foreground">
          {insight.href ? (
            <Link
              href={insight.href}
              className="inline-flex items-start gap-1 hover:text-primary"
            >
              <span>{insight.title}</span>
              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
            </Link>
          ) : (
            insight.title
          )}
        </h4>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.description}
        </p>

        <p className="font-mono text-xs text-foreground/85 tabular-nums">
          {insight.metric}
        </p>

        {insight.whyAppeared ? (
          <p className="text-[11px] text-muted-foreground/90 leading-relaxed border-l-2 border-primary/20 pl-3">
            <span className="font-medium text-foreground/80">
              {t("feed.whyAppeared")}:{" "}
            </span>
            {insight.whyAppeared}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-4">
        {insight.actions.map((action) => (
          <Link
            key={action.href + action.labelKey}
            href={action.href}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t(action.labelKey)}
          </Link>
        ))}
        <span className="ml-auto">
          <SaveResearchButton
            type="feed_signal"
            title={insight.title}
            payload={{
              ...item,
              final_score: item.final_score,
              section: insight.section,
            }}
            tags={[insight.section, item.creator_name ?? "feed"].filter(Boolean) as string[]}
            label={t("research.saveFeed")}
          />
        </span>
      </div>

      {insight.creator_name && insight.section !== "audience" ? (
        <div className="mt-2" onClick={(e) => e.preventDefault()}>
          <QuickCompare currentCreator={insight.creator_name} />
        </div>
      ) : null}
    </article>
  );
}
