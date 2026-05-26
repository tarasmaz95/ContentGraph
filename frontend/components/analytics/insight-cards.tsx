import type { DashboardAnalytics } from "@/types/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InsightCardsProps {
  data: DashboardAnalytics;
}

/** Dashboard highlight cards: patterns, keywords, hooks, creators, trends */
export function InsightCards({ data }: InsightCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <ListCard title="Top Patterns" items={data.top_patterns} empty="No patterns yet" />
      <KeywordCard title="Viral Keywords" keywords={data.viral_keywords} />
      <HookCard title="Best Hook Types" hooks={data.best_hook_types} />
      <CreatorCard title="Top Creators" creators={data.top_creators} />
      <ListCard title="Trending Topics" items={data.trending_topics} empty="No topics detected" />
      <ListCard
        title="Title Structures"
        items={data.title_analysis.common_structures}
        empty="Sync data first"
      />
    </div>
  );
}

function ListCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((item) => (
              <li key={item} className="rounded bg-muted/50 px-2 py-1">
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordCard({
  title,
  keywords,
}: {
  title: string;
  keywords: DashboardAnalytics["viral_keywords"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keywords</p>
        ) : (
          keywords.map((k) => (
            <span
              key={k.keyword}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              title={`${k.count} titles · ${k.avg_views.toLocaleString()} avg views`}
            >
              {k.keyword}
            </span>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function HookCard({
  title,
  hooks,
}: {
  title: string;
  hooks: DashboardAnalytics["best_hook_types"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hooks.map((h) => (
          <div key={h.hook_type} className="flex justify-between text-sm">
            <span className="font-medium">{h.hook_type}</span>
            <span className="text-muted-foreground tabular-nums">
              {h.avg_views.toLocaleString()} avg
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CreatorCard({
  title,
  creators,
}: {
  title: string;
  creators: DashboardAnalytics["top_creators"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {creators.map((c) => (
          <div key={c.creator_name} className="flex justify-between text-sm">
            <span>{c.creator_name}</span>
            <span className="tabular-nums text-muted-foreground">
              {c.total_views.toLocaleString()} views
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
