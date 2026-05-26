"use client";

import type { ResearchSectionId } from "@/lib/feed-briefing";
import { useT } from "@/lib/i18n";

const HINT_KEYS: Partial<Record<ResearchSectionId, string>> = {
  accelerated: "feed.sectionHints.accelerated",
  audience: "feed.sectionHints.audience",
  patterns: "feed.sectionHints.patterns",
  creators: "feed.sectionHints.creators",
  themes: "feed.sectionHints.themes",
};

export function FeedSectionHint({ sectionId }: { sectionId: ResearchSectionId }) {
  const t = useT();
  const key = HINT_KEYS[sectionId];
  if (!key) return null;
  return <p className="text-[11px] text-muted-foreground/90 leading-relaxed">{t(key)}</p>;
}
