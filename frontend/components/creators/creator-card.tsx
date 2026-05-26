import Link from "next/link";

import { slugifyCreatorName } from "@/lib/creator-slug";
import type { CreatorListItem } from "@/types/creator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CreatorCardProps {
  creator: CreatorListItem;
}

/** Creator summary card for /creators grid */
export function CreatorCard({ creator }: CreatorCardProps) {
  const href = `/creators/${slugifyCreatorName(creator.creator_name)}`;

  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{creator.creator_name}</CardTitle>
            {creator.has_profile && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                AI Profile
              </span>
            )}
          </div>
          <CardDescription>
            {creator.total_videos} videos · {creator.avg_views.toLocaleString()} avg views
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {creator.creator_summary || "Open to generate creator intelligence profile."}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
