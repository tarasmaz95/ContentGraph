import type { ReactNode } from "react";

import type { CreatorPageSections } from "@/types/creator-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CreatorAnalyticsSectionsProps {
  sections: CreatorPageSections;
}

/** Analytics blocks — top videos, hooks, topics, keywords, patterns */
export function CreatorAnalyticsSections({ sections }: CreatorAnalyticsSectionsProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Top Performing Videos" description="Ranked by views in your dataset">
        <ul className="divide-y text-sm">
          {sections.top_videos.map((v, i) => (
            <li key={v.id} className="flex gap-3 py-3 first:pt-0">
              <span className="w-6 shrink-0 font-mono text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{v.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {v.views_count.toLocaleString()} views
                  {v.has_transcript ? " · transcript ✓" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Hook Analysis" description="Title hook types and emotional triggers">
          <TagGroup label="Top hooks" items={sections.hook_analysis.top_hooks} />
          <div className="mt-3 space-y-2">
            {sections.hook_analysis.hook_types.slice(0, 6).map((h) => (
              <div
                key={h.hook_type}
                className="flex justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="truncate">{h.hook_type}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {h.count} · {h.avg_views.toLocaleString()} avg
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Topic Clusters" description="Themes from keywords and hooks">
          <div className="flex flex-wrap gap-2">
            {sections.topic_clusters.map((topic) => (
              <span key={topic} className="rounded-full bg-primary/10 px-3 py-1 text-sm">
                {topic}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Viral Keywords" description="High-performing title words">
          <div className="space-y-2">
            {sections.viral_keywords.slice(0, 12).map((k) => (
              <div key={k.keyword} className="flex justify-between text-sm">
                <span className="font-medium">{k.keyword}</span>
                <span className="text-muted-foreground tabular-nums">
                  {k.count}× · {k.avg_views.toLocaleString()} avg
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Content Patterns" description="Recurring title structures">
          <ul className="list-inside list-disc space-y-1 text-sm">
            {sections.content_patterns.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Title Structures"
          description="Length buckets and format distribution"
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap gap-2">
            {sections.title_structures.map((s) => (
              <span key={s} className="rounded border px-2 py-1 text-xs">
                {s}
              </span>
            ))}
          </div>
          {sections.title_analysis.common_structures.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Patterns: {sections.title_analysis.top_patterns.join(", ")}
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TagGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded bg-muted px-2 py-0.5 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
