import { humanizeFeedItem } from "@/lib/feed-display-copy";
import type { FeedItem } from "@/types/copilot";

type BriefingT = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type FeedSectionId =
  | "breakouts"
  | "creators"
  | "audience"
  | "hooks"
  | "accelerated"
  | "patterns"
  | "themes";

export interface FeedCardAction {
  labelKey: string;
  href: string;
}

export interface CuratedInsight {
  id: string;
  section: FeedSectionId;
  source: FeedItem;
  title: string;
  description: string;
  metric: string;
  whyAppeared: string;
  whyMatters: string;
  href?: string | null;
  creator_name?: string | null;
  finalScore?: number;
  evidenceCount?: number;
  timeWindow?: string;
  actions: FeedCardAction[];
}

export interface FeedSectionData {
  id: FeedSectionId;
  insights: CuratedInsight[];
}

function buildActions(
  item: FeedItem,
  section: FeedSectionId,
): FeedCardAction[] {
  const actions: FeedCardAction[] = [];

  if (item.href?.startsWith("/videos/")) {
    actions.push({ labelKey: "feed.actions.openVideo", href: item.href });
  }
  if (item.href?.startsWith("/creators/")) {
    actions.push({ labelKey: "feed.actions.openCreator", href: item.href });
  }
  if (section === "hooks" || section === "patterns") {
    actions.push({ labelKey: "feed.actions.exploreHooks", href: "/hooks" });
  }
  if (item.category === "audience") {
    actions.push({
      labelKey: "feed.actions.inspectAudience",
      href: item.href ?? "/dashboard",
    });
  }
  if (
    (section === "breakouts" ||
      section === "accelerated" ||
      section === "creators") &&
    item.creator_name
  ) {
    actions.push({ labelKey: "feed.actions.openCompare", href: "/compare" });
  }
  if (item.href?.startsWith("/videos/")) {
    actions.push({
      labelKey: "feed.actions.exploreSimilar",
      href: `/dashboard?semantic=${encodeURIComponent(item.title.slice(0, 60))}`,
    });
  }

  return actions.slice(0, 4);
}

export function toInsightFromItem(
  item: FeedItem,
  section: FeedSectionId,
  t?: BriefingT,
): CuratedInsight {
  const copy = t ? humanizeFeedItem(item, t) : null;
  return {
    id: item.id,
    section,
    source: item,
    title: copy?.title ?? item.title,
    description:
      copy?.description ?? (item.description || item.why_matters || ""),
    metric: copy?.metric ?? item.summary ?? "",
    whyAppeared: "",
    whyMatters: copy?.whyMatters ?? (item.why_matters || ""),
    href: item.href,
    creator_name: item.creator_name,
    finalScore: item.final_score,
    evidenceCount: item.evidence_count,
    timeWindow: item.time_window,
    actions: buildActions(item, section),
  };
}

/** @deprecated Use buildDailyBriefing from feed-briefing.ts */
export function curateFeedItems(items: FeedItem[]): FeedSectionData[] {
  const buckets: Record<string, CuratedInsight[]> = {
    breakouts: [],
    creators: [],
    audience: [],
    hooks: [],
  };

  for (const item of items) {
    const section = (item.section || "creators") as FeedSectionId;
    const key =
      section === "hooks"
        ? "hooks"
        : section === "audience"
          ? "audience"
          : section === "breakouts"
            ? "breakouts"
            : "creators";
    if (key in buckets) {
      buckets[key].push(toInsightFromItem(item, section));
    }
  }

  return (["breakouts", "creators", "audience", "hooks"] as const)
    .map((id) => ({ id, insights: buckets[id] ?? [] }))
    .filter((s) => s.insights.length > 0);
}

export function totalCuratedCount(sections: FeedSectionData[]): number {
  return sections.reduce((n, s) => n + s.insights.length, 0);
}

export function hasMinimumFeed(sections: FeedSectionData[]): boolean {
  return totalCuratedCount(sections) >= 1;
}
