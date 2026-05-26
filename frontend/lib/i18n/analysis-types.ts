import type { Locale } from "./types";
import { translate } from "./translate";

const TYPE_KEYS = [
  "creator_analysis",
  "creator_profile",
  "creator_comparison",
  "hook_analysis",
  "hook_generation",
  "hook_comparison",
  "script_generation",
  "script_analysis",
  "video_breakdown",
  "transcript_analysis",
  "viral_analysis",
  "trend_analysis",
  "title_analysis",
  "audience_analysis",
  "comments_analysis",
  "general_chat",
] as const;

export function getAnalysisTypeLabel(locale: Locale, analysisType: string): string {
  if (TYPE_KEYS.includes(analysisType as (typeof TYPE_KEYS)[number])) {
    return translate(locale, `chat.types.${analysisType}`);
  }
  return analysisType;
}
