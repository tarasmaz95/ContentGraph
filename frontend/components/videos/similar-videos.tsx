import Link from "next/link";

import type { SimilarVideoItem } from "@/types/video-intelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SimilarVideosProps {
  videos: SimilarVideoItem[];
}

/** Semantic + hook-related neighbors */
export function SimilarVideos({ videos }: SimilarVideosProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Similar Videos</CardTitle>
        <CardDescription>Related by theme, transcript, and hook patterns</CardDescription>
      </CardHeader>
      <CardContent>
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No similar videos found.</p>
        ) : (
          <ul className="divide-y text-sm">
            {videos.map((v) => (
              <li key={v.id} className="py-3 first:pt-0">
                <Link href={`/videos/${v.id}`} className="font-medium text-primary hover:underline">
                  {v.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.creator_name} · {v.views_count.toLocaleString()} views
                  {v.similarity_score > 0 &&
                    ` · ${(v.similarity_score * 100).toFixed(0)}% match`}
                  {v.shared_hook_type && ` · shared ${v.shared_hook_type} hook`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
