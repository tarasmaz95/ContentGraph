import type { FeedBriefingMeta, FeedItem } from "@/types/copilot";

import {
  type CuratedInsight,
  type FeedSectionId,
  toInsightFromItem,
} from "@/lib/feed-curate";

/** Research-direction sections (editorial, not DB categories). */
export type ResearchSectionId =
  | "accelerated"
  | "audience"
  | "patterns"
  | "creators"
  | "themes";

export interface ResearchSectionData {
  id: ResearchSectionId;
  insights: CuratedInsight[];
}

export interface DailyBriefingLayout {
  hero: CuratedInsight | null;
  sections: ResearchSectionData[];
  researchPath: ResearchPathStep[];
  hasSnapshotHistory: boolean;
  totalSignals: number;
}

export interface ResearchPathStep {
  order: number;
  label: string;
  href?: string | null;
  sectionId?: ResearchSectionId | "hero";
}

type BriefingT = (
  key: string,
  params?: Record<string, string | number>,
) => string;

const MOMENTUM_CATEGORIES = new Set(["breakout", "creator_growth"]);

const SECTION_ORDER_WITH_SNAPSHOTS: ResearchSectionId[] = [
  "accelerated",
  "audience",
  "patterns",
  "themes",
  "creators",
];

const SECTION_ORDER_CATALOG_ONLY: ResearchSectionId[] = [
  "audience",
  "patterns",
  "creators",
  "themes",
];

const MAX_PER_SECTION = 2;
const MAX_PATH_STEPS = 4;

function mapResearchSection(item: FeedItem): ResearchSectionId {
  switch (item.category) {
    case "breakout":
    case "creator_growth":
      return "accelerated";
    case "audience":
      return "audience";
    case "hook_pattern":
      return "patterns";
    case "creator_strength":
      return "creators";
    default:
      return "creators";
  }
}

function pickHero(
  items: FeedItem[],
  hasSnapshotHistory: boolean,
  t?: BriefingT,
): CuratedInsight | null {
  if (!items.length) return null;

  const insights = items.map((item) =>
    toInsightFromItem(item, mapResearchSection(item), t),
  );

  if (hasSnapshotHistory) {
    const momentum = insights.filter((i) =>
      MOMENTUM_CATEGORIES.has(i.source.category),
    );
    if (momentum.length) {
      return [...momentum].sort(
        (a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0),
      )[0];
    }
  }

  return [...insights].sort(
    (a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0),
  )[0];
}

/**
 * Cross-creator theme only when not already shown in audience section or hero.
 */
function buildEmergingThemes(
  audiencePool: CuratedInsight[],
  shownSourceIds: Set<string>,
  shownThemes: Set<string>,
  t?: BriefingT,
): CuratedInsight[] {
  for (const insight of audiencePool) {
    const sourceId = insight.source.id;
    const theme = insight.source.audience_theme;
    const creators = insight.source.supporting_creators ?? [];
    const videos = insight.source.supporting_videos ?? [];

    if (!theme || creators.length < 2) continue;
    if (shownSourceIds.has(sourceId)) continue;
    if (shownThemes.has(theme)) continue;
    if (videos.length < 2) continue;

    const themeLabel = theme.replace(/_/g, " ");
    const n = insight.evidenceCount ?? 0;

    return [
      {
        ...insight,
        id: `emerging-${theme}`,
        section: "themes" as FeedSectionId,
        title: t
          ? t("feed.emerging.title", {
              theme: themeLabel,
              creators: creators.length,
            })
          : `“${themeLabel}” shows up across ${creators.length} creators`,
        description: t
          ? t("feed.emerging.description", { count: n })
          : `${n} comments share this theme — compare how each creator handles it.`,
        whyAppeared: "",
        whyMatters: t ? t("feed.emerging.whyMatters") : "",
        actions: insight.actions,
      },
    ];
  }

  return [];
}

function buildResearchPath(
  hero: CuratedInsight | null,
  sections: ResearchSectionData[],
): ResearchPathStep[] {
  const seenIds = new Set<string>();
  if (hero?.source.id) {
    seenIds.add(hero.source.id);
  }

  const steps: ResearchPathStep[] = [];
  let order = 1;

  for (const section of sections) {
    for (const insight of section.insights) {
      const sourceId = insight.source.id;
      if (seenIds.has(sourceId)) continue;
      seenIds.add(sourceId);
      if (steps.length >= MAX_PATH_STEPS) break;

      steps.push({
        order: order++,
        label: insight.title,
        href: insight.href,
        sectionId: section.id,
      });
    }
    if (steps.length >= MAX_PATH_STEPS) break;
  }

  return steps;
}

/**
 * Turn ranked API items into a daily briefing layout (hero + sections + path).
 */
export function buildDailyBriefing(
  items: FeedItem[],
  briefing?: FeedBriefingMeta | null,
  t?: BriefingT,
): DailyBriefingLayout {
  const hasSnapshotHistory = Boolean(briefing?.has_snapshot_history);
  const hero = pickHero(items, hasSnapshotHistory, t);
  const heroId = hero?.id;

  const buckets: Record<ResearchSectionId, CuratedInsight[]> = {
    accelerated: [],
    audience: [],
    patterns: [],
    creators: [],
    themes: [],
  };

  for (const item of items) {
    if (item.id === heroId) continue;
    const researchSection = mapResearchSection(item);
    const insight = toInsightFromItem(item, researchSection, t);
    if (buckets[researchSection].length < MAX_PER_SECTION) {
      buckets[researchSection].push(insight);
    }
  }

  const shownSourceIds = new Set<string>();
  const shownThemes = new Set<string>();
  if (hero?.source.id) {
    shownSourceIds.add(hero.source.id);
    if (hero.source.audience_theme) {
      shownThemes.add(hero.source.audience_theme);
    }
  }
  for (const ins of buckets.audience) {
    shownSourceIds.add(ins.source.id);
    if (ins.source.audience_theme) {
      shownThemes.add(ins.source.audience_theme);
    }
  }

  const audiencePool = items
    .filter((i) => i.category === "audience")
    .map((i) => toInsightFromItem(i, "audience", t));

  buckets.themes = buildEmergingThemes(
    audiencePool,
    shownSourceIds,
    shownThemes,
    t,
  );

  const order = hasSnapshotHistory
    ? SECTION_ORDER_WITH_SNAPSHOTS
    : SECTION_ORDER_CATALOG_ONLY;

  const sections = order
    .map((id) => ({
      id,
      insights: buckets[id],
    }))
    .filter((s) => s.insights.length > 0);

  const researchPath = buildResearchPath(hero, sections);
  const totalSignals =
    (hero ? 1 : 0) +
    sections.reduce((n, s) => n + s.insights.length, 0);

  return {
    hero,
    sections,
    researchPath,
    hasSnapshotHistory,
    totalSignals,
  };
}

export function hasBriefingContent(layout: DailyBriefingLayout): boolean {
  return layout.hero != null || layout.sections.length > 0;
}
