import type { ExamplePrompt, PromptPage } from "@/lib/prompts";
import type { Locale } from "./types";
import { translate } from "./translate";

function prompt(
  locale: Locale,
  labelKey: string,
  textKey: string,
  action: ExamplePrompt["action"],
): ExamplePrompt {
  return {
    label: translate(locale, labelKey),
    text: translate(locale, textKey),
    action,
  };
}

/** Localized example prompts per page */
export function getPagePrompts(locale: Locale): Record<PromptPage, ExamplePrompt[]> {
  return {
    dashboard: [
      prompt(locale, "prompts.dashboard.trending.label", "prompts.dashboard.trending.text", "chat"),
      prompt(locale, "prompts.dashboard.topHooks.label", "prompts.dashboard.topHooks.text", "chat"),
      prompt(
        locale,
        "prompts.dashboard.semanticDiscipline.label",
        "prompts.dashboard.semanticDiscipline.text",
        "semantic",
      ),
    ],
    creators: [
      prompt(locale, "prompts.creators.danKoe.label", "prompts.creators.danKoe.text", "chat"),
      prompt(locale, "prompts.creators.compare.label", "prompts.creators.compare.text", "chat"),
      prompt(locale, "prompts.creators.communication.label", "prompts.creators.communication.text", "chat"),
    ],
    creator: [
      prompt(locale, "prompts.creator.profile.label", "prompts.creator.profile.text", "chat"),
      prompt(locale, "prompts.creator.bestHooks.label", "prompts.creator.bestHooks.text", "chat"),
      prompt(locale, "prompts.creator.generate.label", "prompts.creator.generate.text", "chat"),
    ],
    hooks: [
      prompt(locale, "prompts.hooks.aiHooks.label", "prompts.hooks.aiHooks.text", "chat"),
      prompt(locale, "prompts.hooks.curiosity.label", "prompts.hooks.curiosity.text", "chat"),
      prompt(locale, "prompts.hooks.searchIdentity.label", "prompts.hooks.searchIdentity.text", "search"),
    ],
    scripts: [
      prompt(locale, "prompts.scripts.danKoe.label", "prompts.scripts.danKoe.text", "chat"),
      prompt(locale, "prompts.scripts.philosophical.label", "prompts.scripts.philosophical.text", "chat"),
      prompt(locale, "prompts.scripts.analyze.label", "prompts.scripts.analyze.text", "chat"),
    ],
    videos: [
      prompt(locale, "prompts.videos.whyViral.label", "prompts.videos.whyViral.text", "chat"),
      prompt(locale, "prompts.videos.transcript.label", "prompts.videos.transcript.text", "chat"),
      prompt(locale, "prompts.videos.audience.label", "prompts.videos.audience.text", "chat"),
    ],
    video: [
      prompt(locale, "prompts.video.breakdown.label", "prompts.video.breakdown.text", "chat"),
      prompt(locale, "prompts.video.framework.label", "prompts.video.framework.text", "chat"),
      prompt(locale, "prompts.video.similar.label", "prompts.video.similar.text", "semantic"),
    ],
    research: [
      prompt(locale, "prompts.research.comparison.label", "prompts.research.comparison.text", "chat"),
      prompt(locale, "prompts.research.viral.label", "prompts.research.viral.text", "chat"),
      prompt(locale, "prompts.research.opportunities.label", "prompts.research.opportunities.text", "chat"),
    ],
    feed: [
      prompt(locale, "prompts.feed.breakouts.label", "prompts.feed.breakouts.text", "chat"),
      prompt(locale, "prompts.feed.hooks.label", "prompts.feed.hooks.text", "chat"),
      prompt(locale, "prompts.feed.audience.label", "prompts.feed.audience.text", "chat"),
    ],
    chat: [
      prompt(locale, "prompts.chat.danKoe.label", "prompts.chat.danKoe.text", "chat"),
      prompt(locale, "prompts.chat.compare.label", "prompts.chat.compare.text", "chat"),
      prompt(locale, "prompts.chat.hooks.label", "prompts.chat.hooks.text", "chat"),
      prompt(locale, "prompts.chat.audience.label", "prompts.chat.audience.text", "chat"),
    ],
    audience: [
      prompt(locale, "prompts.audience.pain.label", "prompts.audience.pain.text", "chat"),
      prompt(locale, "prompts.audience.confusion.label", "prompts.audience.confusion.text", "chat"),
      prompt(locale, "prompts.audience.sentiment.label", "prompts.audience.sentiment.text", "chat"),
    ],
    semantic: [
      prompt(locale, "prompts.semantic.discipline.label", "prompts.semantic.discipline.text", "semantic"),
      prompt(locale, "prompts.semantic.identity.label", "prompts.semantic.identity.text", "semantic"),
      prompt(locale, "prompts.semantic.aiProductivity.label", "prompts.semantic.aiProductivity.text", "semantic"),
    ],
  };
}

export function getAllExamplePrompts(locale: Locale): ExamplePrompt[] {
  const seen = new Set<string>();
  const out: ExamplePrompt[] = [];
  for (const list of Object.values(getPagePrompts(locale))) {
    for (const item of list) {
      if (!seen.has(item.text)) {
        seen.add(item.text);
        out.push(item);
      }
    }
  }
  return out;
}
