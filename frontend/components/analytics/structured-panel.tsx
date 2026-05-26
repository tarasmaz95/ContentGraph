import type { ReactNode } from "react";

import type {
  CreatorAnalysis,
  CreatorComparisonResult,
  CreatorProfileIntel,
  HookAnalysis,
  HookComparisonIntel,
  HookGenerationIntel,
  ScriptAnalysisIntel,
  ScriptGenerationIntel,
  TranscriptAnalysisIntel,
  VideoBreakdownIntel,
  ViralAnalysisIntel,
  StructuredAnalytics,
  TitleAnalysis,
  TrendAnalysis,
} from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ANALYSIS_TYPE_LABELS } from "@/types/chat";

interface StructuredPanelProps {
  structured: StructuredAnalytics;
}

/** Renders typed structured analytics in chat (cards, badges, metrics) */
export function StructuredPanel({ structured }: StructuredPanelProps) {
  const label = ANALYSIS_TYPE_LABELS[structured.analysis_type] ?? structured.analysis_type;
  const m = structured.metrics;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge label={label} variant="primary" />
        <Badge label={`${m.total_videos} videos`} />
        <Badge label={`${m.avg_views.toLocaleString()} avg views`} />
        {m.curiosity_titles_pct > 0 && (
          <Badge label={`${m.curiosity_titles_pct}% curiosity`} />
        )}
        {m.how_to_titles_pct > 0 && (
          <Badge label={`${m.how_to_titles_pct}% how-to`} />
        )}
      </div>

      {structured.creator_profile && (
        <CreatorProfilePanel data={structured.creator_profile} />
      )}
      {structured.creator_comparison && (
        <CreatorComparisonPanel data={structured.creator_comparison} />
      )}
      {structured.title && <TitlePanel data={structured.title} />}
      {structured.creator && <CreatorPanel data={structured.creator} />}
      {structured.trend && <TrendPanel data={structured.trend} />}
      {structured.hook && <HookPanel data={structured.hook} />}
      {structured.hook_generation && (
        <HookGenerationPanel data={structured.hook_generation} />
      )}
      {structured.hook_comparison && (
        <HookComparisonIntelPanel data={structured.hook_comparison} />
      )}
      {structured.script_generation && (
        <ScriptGenerationPanel data={structured.script_generation} />
      )}
      {structured.script_analysis && (
        <ScriptAnalysisPanel data={structured.script_analysis} />
      )}
      {structured.video_breakdown && (
        <VideoBreakdownPanel data={structured.video_breakdown} />
      )}
      {structured.transcript_analysis && (
        <TranscriptAnalysisPanel data={structured.transcript_analysis} />
      )}
      {structured.viral_analysis && (
        <ViralAnalysisPanel data={structured.viral_analysis} />
      )}
    </div>
  );
}

function VideoBreakdownPanel({ data }: { data: VideoBreakdownIntel }) {
  return (
    <MiniCard title={`Video: ${data.title}`}>
      <p>{data.breakdown.why_performed}</p>
      <p className="text-xs text-muted-foreground">{data.breakdown.hook_effectiveness}</p>
    </MiniCard>
  );
}

function TranscriptAnalysisPanel({ data }: { data: TranscriptAnalysisIntel }) {
  return (
    <MiniCard title="Transcript Analysis">
      <TagList label="Themes" items={data.transcript_intel.repeated_themes} />
      <TagList label="Recommendations" items={data.recommendations} />
    </MiniCard>
  );
}

function ViralAnalysisPanel({ data }: { data: ViralAnalysisIntel }) {
  return (
    <MiniCard title="Viral Analysis">
      <p>{data.summary}</p>
      <TagList label="Factors" items={data.viral.viral_factors} />
    </MiniCard>
  );
}

function ScriptGenerationPanel({ data }: { data: ScriptGenerationIntel }) {
  return (
    <MiniCard title={`Script: ${data.creator_name} — ${data.topic}`}>
      <p className="text-xs text-muted-foreground">Hook: {data.selected_hook}</p>
      {data.style_notes && <p className="text-sm">{data.style_notes}</p>}
      <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs">
        {data.structure.full_script || data.structure.opening_hook}
      </pre>
      <p className="mt-2 text-xs tabular-nums">
        Engagement {data.analytics.estimated_engagement}% · Similarity{" "}
        {data.analytics.creator_similarity}%
      </p>
    </MiniCard>
  );
}

function ScriptAnalysisPanel({ data }: { data: ScriptAnalysisIntel }) {
  return (
    <MiniCard title="Script Analysis">
      <p>{data.summary}</p>
      <TagList label="Recommendations" items={data.recommendations} />
    </MiniCard>
  );
}

function HookGenerationPanel({ data }: { data: HookGenerationIntel }) {
  return (
    <MiniCard title={`Generated: ${data.topic} (${data.hook_type})`}>
      {data.style_notes && <p className="text-xs text-muted-foreground">{data.style_notes}</p>}
      <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
        {data.hooks.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ol>
    </MiniCard>
  );
}

function HookComparisonIntelPanel({ data }: { data: HookComparisonIntel }) {
  return (
    <MiniCard title="Hook Comparison">
      <p>{data.summary}</p>
      <TagList label="Leader creators" items={data.creator_leaders} />
      <TagList label="Recommendations" items={data.recommendations} />
    </MiniCard>
  );
}

function Badge({ label, variant }: { label: string; variant?: "primary" }) {
  return (
    <span
      className={
        variant === "primary"
          ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
      }
    >
      {label}
    </span>
  );
}

function TitlePanel({ data }: { data: TitleAnalysis }) {
  return (
    <MiniCard title="Title Analytics">
      <TagList label="Top Patterns" items={data.top_patterns} />
      <TagList label="Emotional Keywords" items={data.emotional_keywords} />
      <KeywordRows keywords={data.best_performing_keywords} />
      <TagList label="Structures" items={data.common_structures} />
    </MiniCard>
  );
}

function CreatorPanel({ data }: { data: CreatorAnalysis }) {
  return (
    <MiniCard title={`Creator: ${data.creator_name}`}>
      <p className="text-sm text-muted-foreground">{data.content_style}</p>
      <TagList label="Topics" items={data.top_topics} />
      <TagList label="Best Hooks" items={data.best_hooks} />
      <TagList label="Top Titles" items={data.top_performing_titles.slice(0, 5)} />
    </MiniCard>
  );
}

function TrendPanel({ data }: { data: TrendAnalysis }) {
  return (
    <MiniCard title="Trend Analytics">
      <TagList label="Trending Topics" items={data.trending_topics} />
      <KeywordRows keywords={data.rising_keywords} />
      <TagList label="Growing Creators" items={data.fastest_growing_creators} />
      <TagList label="Viral Patterns" items={data.viral_patterns} />
    </MiniCard>
  );
}

function HookPanel({ data }: { data: HookAnalysis }) {
  return (
    <MiniCard title="Hook Analytics">
      <div className="flex flex-wrap gap-2">
        {data.hook_types.slice(0, 6).map((h) => (
          <Badge
            key={h.hook_type}
            label={`${h.hook_type} (${h.avg_views.toLocaleString()})`}
          />
        ))}
      </div>
      <TagList label="Top Hooks" items={data.top_hooks} />
      <PatternRows label="Curiosity" patterns={data.curiosity_patterns} />
      <PatternRows label="Transformation" patterns={data.transformation_hooks} />
      <PatternRows label="Urgency" patterns={data.urgency_hooks} />
    </MiniCard>
  );
}

function CreatorProfilePanel({ data }: { data: CreatorProfileIntel }) {
  return (
    <MiniCard title={`Creator: ${data.creator_name}`}>
      <p className="text-muted-foreground">{data.creator_summary}</p>
      <TagList label="Style" items={[data.content_style]} />
      <TagList label="Topics" items={data.top_topics} />
      <TagList label="Hooks" items={data.hook_patterns} />
      <TagList label="Communication" items={[data.communication_style]} />
      <TagList label="Audience" items={[data.audience_type]} />
      <TagList label="Strategic Insights" items={data.strategic_insights} />
    </MiniCard>
  );
}

function CreatorComparisonPanel({ data }: { data: CreatorComparisonResult }) {
  return (
    <MiniCard title={`Compare: ${data.creators.join(" vs ")}`}>
      <p>{data.summary}</p>
      <p className="text-xs font-semibold text-muted-foreground">Style</p>
      <p>{data.style_comparison}</p>
      <TagList label="Hooks" items={data.hook_comparison} />
      <TagList label="Topics" items={data.topic_comparison} />
      <TagList label="Positioning" items={data.positioning_comparison} />
      <TagList label="Recommendations" items={data.recommendations} />
    </MiniCard>
  );
}

function MiniCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded bg-muted px-2 py-0.5 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function KeywordRows({ keywords }: { keywords: { keyword: string; avg_views: number }[] }) {
  if (!keywords.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">Keywords</p>
      {keywords.slice(0, 6).map((k) => (
        <div key={k.keyword} className="flex justify-between text-xs">
          <span>{k.keyword}</span>
          <span className="tabular-nums text-muted-foreground">
            {k.avg_views.toLocaleString()} avg
          </span>
        </div>
      ))}
    </div>
  );
}

function PatternRows({
  label,
  patterns,
}: {
  label: string;
  patterns: { pattern: string; avg_views: number }[];
}) {
  if (!patterns.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {patterns.slice(0, 4).map((p) => (
        <div key={p.pattern} className="flex justify-between text-xs">
          <span>{p.pattern}</span>
          <span className="text-muted-foreground">{p.avg_views.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
