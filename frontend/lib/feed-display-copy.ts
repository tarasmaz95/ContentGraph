import type { FeedItem } from "@/types/copilot";

type BriefingT = (
  key: string,
  params?: Record<string, string | number>,
) => string;

const AUDIENCE_TITLE_KEYS: Record<string, string> = {
  curiosity: "feed.copy.audience.titleCuriosity",
  positive: "feed.copy.audience.titlePositive",
  negative: "feed.copy.audience.titleNegative",
};

const HOOK_TITLE_KEYS: Record<string, string> = {
  identity: "feed.copy.hook.titleIdentity",
  authority: "feed.copy.hook.titleAuthority",
  curiosity: "feed.copy.hook.titleCuriosity",
  controversy: "feed.copy.hook.titleControversy",
  listicle: "feed.copy.hook.titleListicle",
  tutorial: "feed.copy.hook.titleTutorial",
};

/** Plain-language card copy — API fields unchanged; display only. */
export function humanizeFeedItem(
  item: FeedItem,
  t: BriefingT,
): {
  title: string;
  description: string;
  metric: string;
  whyMatters: string;
} {
  const creators = item.supporting_creators?.length ?? 0;
  const videos = item.supporting_videos?.length ?? 0;
  const comments = item.evidence_count ?? item.video_count ?? 0;
  const theme = item.audience_theme ?? "";
  const hook = item.hook_type ?? "";

  switch (item.category) {
    case "audience": {
      const titleKey =
        AUDIENCE_TITLE_KEYS[theme] ?? "feed.copy.audience.titleDefault";
      return {
        title: t(titleKey),
        description: t("feed.copy.audience.description", {
          creators,
          comments,
        }),
        metric: t("feed.copy.audience.metric", {
          likes: formatLikesFromSummary(item.summary),
          videos,
        }),
        whyMatters: t("feed.copy.audience.whyMatters"),
      };
    }
    case "hook_pattern": {
      const titleKey = HOOK_TITLE_KEYS[hook] ?? "feed.copy.hook.titleDefault";
      return {
        title: t(titleKey),
        description: t("feed.copy.hook.description"),
        metric: t("feed.copy.hook.metric", { count: comments }),
        whyMatters: t("feed.copy.hook.whyMatters"),
      };
    }
    case "creator_strength":
      return {
        title: t("feed.copy.creator.title", {
          name: item.creator_name ?? "This creator",
        }),
        description: t("feed.copy.creator.description", {
          count: item.video_count ?? comments,
        }),
        metric: "",
        whyMatters: t("feed.copy.creator.whyMatters"),
      };
    case "breakout":
      return {
        title: t("feed.copy.breakout.title", {
          name: item.creator_name ?? t("feed.copy.breakout.fallbackName"),
        }),
        description: t("feed.copy.breakout.description"),
        metric: "",
        whyMatters: t("feed.copy.breakout.whyMatters"),
      };
    case "creator_growth":
      return {
        title: t("feed.copy.growth.title", {
          name: item.creator_name ?? "",
        }),
        description: t("feed.copy.growth.description"),
        metric: "",
        whyMatters: t("feed.copy.growth.whyMatters"),
      };
    default:
      return {
        title: item.title,
        description: item.description || item.why_matters || "",
        metric: item.summary ?? "",
        whyMatters: item.why_matters || "",
      };
  }
}

function formatLikesFromSummary(summary: string | null | undefined): string {
  if (!summary) return "";
  const m = summary.match(/^([\d,]+)\s+combined likes/i);
  return m?.[1] ?? "";
}
