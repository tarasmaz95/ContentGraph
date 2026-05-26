"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SaveResearchButton } from "@/components/research/save-research-button";
import type { CuratedInsight } from "@/lib/feed-curate";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface FeedHeroProps {
  insight: CuratedInsight;
}

const primaryBtn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90";
const secondaryBtn =
  "inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground";

export function FeedHero({ insight }: FeedHeroProps) {
  const t = useT();
  const { source: item } = insight;

  const [primary, ...secondary] = insight.actions;
  const metaParts: string[] = [];
  if (insight.metric?.trim()) metaParts.push(insight.metric.trim());
  const supporting = insight.source.supporting_videos ?? [];
  if (supporting.length > 1) {
    metaParts.push(t("feed.hero.relatedVideos", { count: supporting.length }));
  }

  return (
    <article
      className="relative sm:pl-6"
      aria-labelledby="feed-hero-title"
    >
      <div
        className="absolute left-0 top-1 hidden h-[calc(100%-0.25rem)] w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent sm:block"
        aria-hidden
      />

      <p className="text-xs font-medium tracking-wide text-muted-foreground">
        {t("feed.hero.label")}
      </p>

      <h2
        id="feed-hero-title"
        className="mt-3 max-w-2xl text-2xl font-semibold leading-[1.2] tracking-tight text-foreground sm:text-[1.75rem] sm:leading-[1.25]"
      >
        {insight.href ? (
          <Link href={insight.href} className="group inline hover:text-primary">
            {insight.title}
            <ArrowRight className="ml-1.5 inline h-4 w-4 opacity-0 transition-opacity group-hover:opacity-70" />
          </Link>
        ) : (
          insight.title
        )}
      </h2>

      {insight.description ? (
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          {insight.description}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {primary ? (
          <Link href={primary.href} className={primaryBtn}>
            {t(primary.labelKey)}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        {secondary.map((action) => (
          <Link
            key={action.href + action.labelKey}
            href={action.href}
            className={secondaryBtn}
          >
            {t(action.labelKey)}
          </Link>
        ))}
        <div className={cn("sm:ml-auto", secondary.length === 0 && !primary && "ml-0")}>
          <SaveResearchButton
            type="feed_signal"
            title={insight.title}
            payload={{
              ...item,
              final_score: item.final_score,
              section: "hero",
              briefing_role: "hero",
            }}
            tags={["hero", item.creator_name ?? "feed"].filter(Boolean) as string[]}
            label={t("research.saveFeed")}
          />
        </div>
      </div>

      {metaParts.length > 0 ? (
        <p className="mt-5 text-xs text-muted-foreground/75">
          {metaParts.join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
