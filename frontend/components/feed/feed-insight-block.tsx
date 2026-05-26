"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { QuickCompare } from "@/components/convenience/quick-compare";
import { SaveResearchButton } from "@/components/research/save-research-button";
import type { CuratedInsight } from "@/lib/feed-curate";
import { useT } from "@/lib/i18n";

interface FeedInsightBlockProps {
  insight: CuratedInsight;
}

const primaryBtn =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md bg-foreground/[0.06] px-3 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.1]";
const textLink =
  "text-xs font-medium text-muted-foreground transition-colors hover:text-foreground";

export function FeedInsightBlock({ insight }: FeedInsightBlockProps) {
  const t = useT();
  const { source: item } = insight;
  const [primary, ...secondary] = insight.actions.slice(0, 3);

  return (
    <article className="py-5">
      <h4 className="text-[15px] font-medium leading-snug tracking-tight text-foreground">
        {insight.href ? (
          <Link href={insight.href} className="hover:text-primary">
            {insight.title}
          </Link>
        ) : (
          insight.title
        )}
      </h4>

      {insight.description ? (
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {insight.description}
        </p>
      ) : null}

      {insight.metric ? (
        <p className="mt-1 text-[11px] text-muted-foreground/70">{insight.metric}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {primary ? (
          <Link href={primary.href} className={primaryBtn}>
            {t(primary.labelKey)}
            <ArrowRight className="h-3 w-3 opacity-60" />
          </Link>
        ) : null}
        {secondary.map((action) => (
          <Link
            key={action.href + action.labelKey}
            href={action.href}
            className={textLink}
          >
            {t(action.labelKey)}
          </Link>
        ))}
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
      </div>

      {insight.creator_name && item.category !== "audience" ? (
        <div className="mt-2.5" onClick={(e) => e.preventDefault()}>
          <QuickCompare currentCreator={insight.creator_name} />
        </div>
      ) : null}
    </article>
  );
}
