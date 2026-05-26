"use client";

import type { DailyBriefingLayout } from "@/lib/feed-briefing";
import { useT } from "@/lib/i18n";
import type { FeedBriefingMeta } from "@/types/copilot";

interface FeedOperationalNoticesProps {
  briefing: FeedBriefingMeta | null;
  layout: DailyBriefingLayout;
}

function hasMomentumSignals(layout: DailyBriefingLayout): boolean {
  const accelerated = layout.sections.find((s) => s.id === "accelerated");
  return Boolean(accelerated?.insights.length);
}

export function FeedOperationalNotices({
  briefing,
  layout,
}: FeedOperationalNoticesProps) {
  const t = useT();
  if (!briefing) return null;

  const messages: string[] = [];
  const momentum = hasMomentumSignals(layout);
  const comments = briefing.comment_count ?? 0;

  if ((briefing.has_snapshot_history && !momentum) || !briefing.has_snapshot_history) {
    messages.push(t("feed.notices.noGrowthYet"));
  }

  if (comments > 0 && comments < 150) {
    messages.push(t("feed.notices.fewComments", { count: comments }));
  }

  if (messages.length === 0) return null;

  return (
    <p
      className="max-w-lg text-[13px] leading-relaxed text-muted-foreground/80"
      role="status"
    >
      {messages.join(" ")}
    </p>
  );
}
