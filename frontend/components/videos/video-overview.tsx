import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { slugifyCreatorName } from "@/lib/creator-slug";
import type { VideoOverview as VideoOverviewType } from "@/types/video-intelligence";
import { HOOK_TYPE_LABELS } from "@/types/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoOverviewProps {
  overview: VideoOverviewType;
}

/** Video header — title, stats, hook type, transcript flag */
export function VideoOverview({ overview }: VideoOverviewProps) {
  const tierColors: Record<string, string> = {
    viral: "bg-green-100 text-green-800",
    strong: "bg-primary/10 text-primary",
    average: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl leading-snug">{overview.title}</CardTitle>
            <p className="mt-2 text-sm">
              <Link
                href={`/creators/${slugifyCreatorName(overview.creator_name)}`}
                className="font-medium text-primary underline"
              >
                {overview.creator_name}
              </Link>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tierColors[overview.performance_tier] ?? tierColors.average
            }`}
          >
            {overview.performance_tier}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6 text-sm">
        <Stat label="Views" value={overview.views_count.toLocaleString()} />
        <Stat label="Subscribers" value={overview.subscribers_count.toLocaleString()} />
        {overview.published_at && (
          <Stat
            label="Published"
            value={new Date(overview.published_at).toLocaleDateString()}
          />
        )}
        <Stat
          label="Transcript"
          value={overview.has_transcript ? "Available" : "Missing"}
        />
        <Stat
          label="Comments"
          value={
            overview.has_comments
              ? `${overview.comment_count} analyzed`
              : "Not fetched"
          }
        />
        {overview.primary_hook_type && (
          <div>
            <p className="text-xs text-muted-foreground">Primary hook</p>
            <p className="font-medium">
              {HOOK_TYPE_LABELS[overview.primary_hook_type] ?? overview.primary_hook_type}
            </p>
          </div>
        )}
        {overview.channel_url && (
          <a
            href={overview.channel_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline"
          >
            Channel <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
