import type { CreatorComparisonResult, CreatorProfile } from "@/types/creator";
import type { CreatorPageAnalytics } from "@/types/creator-page";
import type { HookAnalysis } from "@/types/analytics";
import type { HookGenerateResult, HookPattern } from "@/types/hooks";
import type { ScriptGenerateResult, ScriptStructure } from "@/types/scripts";
import type { VideoIntelligence } from "@/types/video-intelligence";
import type { ChatMessage } from "@/types/chat";

/** Build saveable text from a chat assistant message */
export function formatChatForSave(message: ChatMessage): string {
  const parts: string[] = [];
  if (message.insights?.length) {
    parts.push("Insights:\n" + message.insights.map((i) => `• ${i}`).join("\n"));
  }
  if (message.content) {
    parts.push("Summary:\n" + message.content);
  }
  return parts.join("\n\n");
}

/** Build saveable text from creator profile */
export function formatCreatorProfileForSave(profile: CreatorProfile): string {
  return [
    `Creator: ${profile.creator_name}`,
    `Style: ${profile.content_style}`,
    `Summary: ${profile.creator_summary}`,
    `Topics: ${profile.top_topics.join(", ")}`,
    `Hooks: ${profile.hook_patterns.join(", ")}`,
    `Communication: ${profile.communication_style}`,
    `Audience: ${profile.audience_type}`,
    `Triggers: ${profile.emotional_triggers.join(", ")}`,
    `Stats: ${profile.total_videos} videos, ${profile.avg_views.toLocaleString()} avg views`,
  ].join("\n");
}

/** Build saveable text from hook analysis section */
export function formatHookAnalysisForSave(
  creatorName: string,
  hook: HookAnalysis,
): string {
  const lines = [
    `Creator: ${creatorName}`,
    `Hook Analysis`,
    `Top hooks: ${hook.top_hooks.join(", ")}`,
    "Hook types:",
    ...hook.hook_types.map(
      (h) => `• ${h.hook_type} — ${h.count} videos, ${h.avg_views.toLocaleString()} avg views`,
    ),
    "Curiosity:",
    ...hook.curiosity_patterns.map((p) => `• ${p.pattern} (${p.avg_views.toLocaleString()} avg)`),
    "Transformation:",
    ...hook.transformation_hooks.map((p) => `• ${p.pattern} (${p.avg_views.toLocaleString()} avg)`),
  ];
  return lines.join("\n");
}

/** Build saveable text from viral keywords + content patterns */
export function formatViralPatternsForSave(analytics: CreatorPageAnalytics): string {
  const { overview, sections } = analytics;
  return [
    `Creator: ${overview.creator_name}`,
    "Viral Keywords:",
    ...sections.viral_keywords.map(
      (k) => `• ${k.keyword} — ${k.count}×, ${k.avg_views.toLocaleString()} avg views`,
    ),
    "Content Patterns:",
    ...sections.content_patterns.map((p) => `• ${p}`),
    "Topic Clusters:",
    ...sections.topic_clusters.map((t) => `• ${t}`),
  ].join("\n");
}

/** Save a single hook or collection */
export function formatHooksForSave(
  title: string,
  hooks: string[] | HookPattern[],
): string {
  if (hooks.length === 0) return title;
  if (typeof hooks[0] === "string") {
    return [
      title,
      ...(hooks as string[]).map((h, i) => `${i + 1}. ${h}`),
    ].join("\n");
  }
  const patterns = hooks as HookPattern[];
  return [
    title,
    ...patterns.map(
      (p) =>
        `• [${p.hook_type}] ${p.hook_text.slice(0, 100)} — ${p.creator_name} (${p.views_count.toLocaleString()} views, eff ${(p.effectiveness_score * 100).toFixed(0)}%)`,
    ),
  ].join("\n");
}

export function formatVideoAnalysisForSave(intel: VideoIntelligence): string {
  const b = intel.breakdown;
  return [
    `Video Analysis: ${intel.overview.title}`,
    `Creator: ${intel.overview.creator_name} · ${intel.overview.views_count.toLocaleString()} views`,
    `Why performed: ${b.why_performed}`,
    `Hook: ${b.hook_effectiveness}`,
    `Storytelling: ${b.storytelling_patterns.join(", ")}`,
    `Recommendations:\n${b.recommendations.map((r) => `• ${r}`).join("\n")}`,
  ].join("\n");
}

export function formatTranscriptInsightsForSave(intel: VideoIntelligence): string {
  const t = intel.transcript_intel;
  return [
    `Transcript Insights: ${intel.overview.title}`,
    "Key moments:",
    ...t.key_moments.map((m) => `• ${m.label}: ${m.excerpt}`),
    "Themes:",
    ...t.repeated_themes.map((th) => `• ${th}`),
    "CTAs:",
    ...t.cta_sections.map((c) => `• ${c}`),
  ].join("\n");
}

export function formatAudienceInsightsForSave(intel: VideoIntelligence): string {
  const c = intel.comments;
  return [
    `Audience Insights: ${intel.overview.title}`,
    c.summary,
    `Sentiment: ${c.positive_pct}% positive · ${c.negative_pct}% negative`,
    "Reactions:",
    ...c.audience_reactions.map((r) => `• ${r}`),
    "Pain points:",
    ...c.pain_points.map((p) => `• ${p}`),
    "Desires:",
    ...c.audience_desires.map((d) => `• ${d}`),
    "Confusion:",
    ...c.confusion_points.map((x) => `• ${x}`),
  ].join("\n");
}

export function formatCommentPatternsForSave(intel: VideoIntelligence): string {
  const c = intel.comments;
  return [
    `Comment Patterns: ${intel.overview.title}`,
    "Emotional patterns:",
    ...c.emotional_patterns.map((e) => `• ${e}`),
    "Questions:",
    ...c.questions.map((q) => `• ${q}`),
    "Recurring phrases:",
    ...c.recurring_phrases.map((p) => `• ${p}`),
    "Top comments:",
    ...c.top_comments.slice(0, 5).map(
      (t) => `• [${t.sentiment}] ${t.comment_text.slice(0, 120)}`,
    ),
  ].join("\n");
}

export function formatViralFrameworksForSave(intel: VideoIntelligence): string {
  const v = intel.viral;
  return [
    `Viral Frameworks: ${intel.overview.title}`,
    "Factors:",
    ...v.viral_factors.map((f) => `• ${f}`),
    "Frameworks:",
    ...v.reusable_frameworks.map((f) => `• ${f}`),
  ].join("\n");
}

export function formatScriptForSave(result: ScriptGenerateResult): string {
  const s = result.structure;
  return [
    `Script: ${result.creator_name} — ${result.topic}`,
    `Duration: ${result.duration} · Tone: ${result.tone} · Hook: ${result.hook_type}`,
    `Selected hook: ${result.selected_hook}`,
    "",
    s.full_script || [
      `HOOK: ${s.opening_hook}`,
      `INTRO: ${s.intro}`,
      ...s.key_points.map((p, i) => `POINT ${i + 1}: ${p}`),
      ...s.transitions.map((t, i) => `TRANSITION ${i + 1}: ${t}`),
      `CTA: ${s.cta}`,
      `CLOSING: ${s.closing}`,
    ].join("\n"),
    "",
    `Engagement: ${result.analytics.estimated_engagement}% · Similarity: ${result.analytics.creator_similarity}%`,
  ].join("\n");
}

export function formatScriptStructureForSave(
  creator: string,
  structure: ScriptStructure,
): string {
  return [
    `Script structure: ${creator}`,
    `Hook: ${structure.opening_hook}`,
    `Intro: ${structure.intro}`,
    "Key points:",
    ...structure.key_points.map((p) => `• ${p}`),
    "Transitions:",
    ...structure.transitions.map((t) => `• ${t}`),
    `CTA: ${structure.cta}`,
    `Closing: ${structure.closing}`,
  ].join("\n");
}

export function formatGeneratedHooksForSave(result: HookGenerateResult): string {
  return formatHooksForSave(
    `Generated hooks: ${result.topic} (${result.hook_type})${result.creator_name ? ` · ${result.creator_name}` : ""}`,
    result.hooks,
  );
}

/** Build saveable text from comparison result */
export function formatComparisonForSave(result: CreatorComparisonResult): string {
  return [
    `Comparison: ${result.creators.join(" vs ")}`,
    result.summary,
    `Style: ${result.style_comparison}`,
    "Hooks:\n" + result.hook_comparison.map((h) => `• ${h}`).join("\n"),
    "Topics:\n" + result.topic_comparison.map((t) => `• ${t}`).join("\n"),
    "Positioning:\n" + result.positioning_comparison.map((p) => `• ${p}`).join("\n"),
    "Recommendations:\n" + result.recommendations.map((r) => `• ${r}`).join("\n"),
  ].join("\n\n");
}
