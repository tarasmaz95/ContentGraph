import type { ReactNode } from "react";
import { ExternalLink, TrendingUp, Users, Video } from "lucide-react";

import type { CreatorGrowthIntel } from "@/types/creator-intelligence";
import type { CreatorOverview as CreatorOverviewType } from "@/types/creator-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CreatorOverviewProps {
  overview: CreatorOverviewType;
  growth?: CreatorGrowthIntel;
}

/** Header stats — subscribers, videos, top performer */
export function CreatorOverview({ overview, growth }: CreatorOverviewProps) {
  const top = overview.top_video;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-primary" />}
          label="Subscribers"
          value={overview.subscribers_count.toLocaleString()}
        />
        <StatCard
          icon={<Video className="h-4 w-4 text-primary" />}
          label="Videos in dataset"
          value={String(overview.total_videos)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          label="Avg views"
          value={overview.avg_views.toLocaleString()}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          label="Total views"
          value={overview.total_views.toLocaleString()}
        />
        {growth && growth.metrics.snapshot_days > 0 && (
          <>
            <StatCard
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              label="7d growth"
              value={`${growth.metrics.growth_7d_pct.toFixed(1)}%`}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              label="Views / day"
              value={growth.metrics.velocity_views_per_day.toLocaleString()}
            />
          </>
        )}
      </div>

      {top && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Performing Video</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium leading-snug">{top.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {top.views_count.toLocaleString()} views
                {top.published_at
                  ? ` · ${new Date(top.published_at).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            {overview.channel_url && (
              <a
                href={overview.channel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline"
              >
                Channel <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="rounded-md bg-primary/10 p-2">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
