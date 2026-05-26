/** Markdown/text summaries for internal copy (Telegram, Notion). */

import type { CreatorCompareResult } from "@/types/creator-compare";
import type { CreatorIntelligence } from "@/types/creator-intelligence";

export function formatCompareSummaryMarkdown(data: CreatorCompareResult): string {
  const lines = [
    `# ${data.creator_a} vs ${data.creator_b}`,
    "",
    "## Overview",
    "| Signal | A | B |",
    "|---|---|---|",
    ...data.overview_rows.map(
      (r) => `| ${r.signal} | ${r.value_a} | ${r.value_b} |`,
    ),
    "",
  ];
  if (data.growth_winner) lines.push(`**Growth edge:** ${data.growth_winner}`);
  if (data.hooks_winner) lines.push(`**Hook edge:** ${data.hooks_winner}`);
  if (data.momentum_winner) lines.push(`**Momentum edge:** ${data.momentum_winner}`);
  lines.push("", "## Semantic overlap", data.semantic_overlap.summary);
  if (data.semantic_overlap.shared_themes.length) {
    lines.push(`Shared: ${data.semantic_overlap.shared_themes.join(", ")}`);
  }
  lines.push(
    "",
    "## Title battle — A",
    ...data.title_battle_a.map(
      (t, i) =>
        `${i + 1}. **${t.title}** (${t.views_count.toLocaleString()} views, ${t.hook_type})`,
    ),
    "",
    "## Title battle — B",
    ...data.title_battle_b.map(
      (t, i) =>
        `${i + 1}. **${t.title}** (${t.views_count.toLocaleString()} views, ${t.hook_type})`,
    ),
  );
  return lines.join("\n");
}

export function formatCreatorIntelMarkdown(intel: CreatorIntelligence): string {
  const o = intel.overview;
  const g = intel.growth.metrics;
  const m = intel.hooks.mix;
  return [
    `# ${o.creator_name}`,
    "",
    `- Videos: ${o.total_videos} · Avg views: ${o.avg_views.toLocaleString()}`,
    `- Subscribers: ${o.subscribers_count.toLocaleString()} · Total views: ${o.total_views.toLocaleString()}`,
    `- Growth 7d: ${g.growth_7d_pct.toFixed(1)}% · Velocity: ${g.velocity_views_per_day.toLocaleString()}/day`,
    "",
    "## Hook mix",
    `Curiosity ${m.curiosity_pct}% · Numbers ${m.numbers_pct}% · Authority ${m.authority_pct}% · Identity ${m.identity_pct}%`,
    intel.hooks.best_performing_hooks.length
      ? `Best hooks: ${intel.hooks.best_performing_hooks.join(", ")}`
      : "",
    "",
    "## Positioning",
    intel.semantic.positioning_summary,
    intel.semantic.themes.length ? `Themes: ${intel.semantic.themes.join("; ")}` : "",
    "",
    "## Audience",
    intel.audience.total_comments
      ? `${intel.audience.total_comments} comments · ${intel.audience.pain_points.slice(0, 5).join(" · ")}`
      : "_No comments saved yet_",
    "",
    "## Breakouts",
    ...intel.momentum.breakout_videos.slice(0, 5).map(
      (v) => `- ${v.title} (+${v.views_delta_7d.toLocaleString()} views 7d)`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatHooksMarkdown(intel: CreatorIntelligence): string {
  const m = intel.hooks.mix;
  return [
    `# Hooks — ${intel.overview.creator_name}`,
    `Curiosity ${m.curiosity_pct}% · Transformation ${m.transformation_pct}% · Urgency ${m.urgency_pct}%`,
    `Numbers ${m.numbers_pct}% · Authority ${m.authority_pct}% · How-to ${m.how_to_pct}%`,
    intel.hooks.best_performing_hooks.length
      ? `\nBest: ${intel.hooks.best_performing_hooks.join(", ")}`
      : "",
  ].join("\n");
}

export function formatAudienceMarkdown(intel: CreatorIntelligence): string {
  const a = intel.audience;
  if (!a.total_comments) return `# Audience — ${intel.overview.creator_name}\n\nNo comments ingested yet.`;
  return [
    `# Audience — ${intel.overview.creator_name}`,
    `Comments analyzed: ${a.total_comments}`,
    "",
    "Emotional patterns:",
    ...a.emotional_patterns.map((e) => `- ${e}`),
    "",
    "Pain points:",
    ...a.pain_points.map((p) => `- ${p}`),
    "",
    "Repeated phrases:",
    ...a.repeated_phrases.map((p) => `- ${p}`),
    "",
    "Top comments:",
    ...a.top_comments.slice(0, 5).map(
      (c) => `- (${c.likes_count} likes) ${c.comment_text.slice(0, 200)}`,
    ),
  ].join("\n");
}

export function formatBreakoutsMarkdown(intel: CreatorIntelligence): string {
  const items = intel.momentum.breakout_videos;
  if (!items.length) {
    return `# Breakouts — ${intel.overview.creator_name}\n\nNo breakout signals yet.`;
  }
  return [
    `# Breakout videos — ${intel.overview.creator_name}`,
    ...items.slice(0, 8).map(
      (v) => `- **${v.title}** — ${v.views_now.toLocaleString()} views (+${v.views_delta_7d.toLocaleString()} 7d)`,
    ),
  ].join("\n");
}
