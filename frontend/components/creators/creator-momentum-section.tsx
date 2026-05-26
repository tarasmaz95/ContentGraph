"use client";

import Link from "next/link";

import type { CreatorMomentumIntel } from "@/types/creator-intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export function CreatorMomentumSection({ momentum }: { momentum: CreatorMomentumIntel }) {
  const t = useT();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <VideoListCard
        title={t("creators.breakoutVideos")}
        videos={momentum.breakout_videos}
        showDelta
      />
      <VideoListCard
        title={t("creators.fastestGrowing")}
        videos={momentum.fastest_growing}
        showDelta
      />
      <VideoListCard title={t("creators.latestUploads")} videos={momentum.latest_uploads} />
    </div>
  );
}

function VideoListCard({
  title,
  videos,
  showDelta = false,
}: {
  title: string;
  videos: { video_id?: number; id?: number; title: string; views_count?: number; views_now?: number; views_delta_7d?: number }[];
  showDelta?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {videos.length === 0 ? (
            <li className="text-muted-foreground">—</li>
          ) : (
            videos.map((v) => {
              const id = "video_id" in v && v.video_id ? v.video_id : v.id;
              const views = v.views_now ?? v.views_count ?? 0;
              return (
                <li key={id} className="rounded bg-muted/40 px-2 py-2">
                  <Link href={`/videos/${id}`} className="font-medium text-primary underline line-clamp-2">
                    {v.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {views.toLocaleString()} views
                    {showDelta && "views_delta_7d" in v && v.views_delta_7d != null
                      ? ` · +${v.views_delta_7d.toLocaleString()} (7d)`
                      : ""}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
