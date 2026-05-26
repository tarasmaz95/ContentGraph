import { memo } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { useT } from "@/lib/i18n";
import { getYouTubeOpenUrl } from "@/lib/youtube-url";
import type { Video } from "@/types/video";

interface VideosTableProps {
  videos: Video[];
  showSimilarity?: boolean;
  onSelectVideo?: (video: Video) => void;
}

/** Video table with transcript badge, preview, and semantic match info */
export const VideosTable = memo(function VideosTable({
  videos,
  showSimilarity = false,
  onSelectVideo,
}: VideosTableProps) {
  const t = useT();
  const matchLabels: Record<string, string> = {
    title: t("videos.matchTitle"),
    transcript: t("videos.matchTranscript"),
    both: t("videos.matchBoth"),
    keyword: t("videos.matchKeyword"),
    comment: t("videos.matchComment"),
  };
  if (videos.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No videos yet. Sync from Google Sheets to load data.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium">Creator</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Transcript</th>
            {showSimilarity && (
              <th className="px-4 py-3 font-medium text-right">Match</th>
            )}
            <th className="px-4 py-3 font-medium text-right">Views</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => (
            <tr
              key={video.id}
              className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
              onClick={() => onSelectVideo?.(video)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectVideo?.(video);
                }
              }}
              tabIndex={onSelectVideo ? 0 : undefined}
              role={onSelectVideo ? "button" : undefined}
              aria-label={
                onSelectVideo
                  ? `Open video: ${video.title} by ${video.creator_name}`
                  : undefined
              }
            >
              <td className="px-4 py-3 font-medium align-top">{video.creator_name}</td>
              <td className="max-w-xs px-4 py-3 align-top">
                <div className="flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    {onSelectVideo ? (
                      <Link
                        href={`/videos/${video.id}`}
                        className="font-medium line-clamp-2 text-primary hover:underline"
                        title={video.title}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {video.title}
                      </Link>
                    ) : (
                      <p className="font-medium line-clamp-2" title={video.title}>
                        {video.title}
                      </p>
                    )}
                  </div>
                  <a
                    href={getYouTubeOpenUrl(video)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("videos.openOnYoutube")}
                    aria-label={t("videos.openOnYoutube")}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>
                {(video.transcript_snippet || video.transcript_preview) && (
                  <p
                    className={`mt-1 text-xs line-clamp-2 ${
                      video.match_source === "transcript" || video.match_source === "both"
                        ? "text-amber-800/90 dark:text-amber-200/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {video.transcript_snippet ?? video.transcript_preview}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 align-top">
                <TranscriptBadge video={video} matchLabels={matchLabels} />
              </td>
              {showSimilarity && (
                <td className="px-4 py-3 text-right align-top tabular-nums">
                  <MatchInfo video={video} labels={matchLabels} />
                </td>
              )}
              <td className="px-4 py-3 text-right align-top tabular-nums">
                {video.views_count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

function TranscriptBadge({
  video,
  matchLabels,
}: {
  video: Video;
  matchLabels?: Record<string, string>;
}) {
  const isTranscriptMatch =
    video.match_source === "transcript" || video.match_source === "both";
  if (video.has_transcript) {
    return (
      <div className="flex flex-col gap-1">
        <span
          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
            isTranscriptMatch
              ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
              : "bg-green-100 text-green-800"
          }`}
        >
          {isTranscriptMatch && matchLabels?.transcript
            ? matchLabels.transcript
            : "Available"}
        </span>
      </div>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      —
    </span>
  );
}

function MatchInfo({
  video,
  labels,
}: {
  video: Video;
  labels: Record<string, string>;
}) {
  const pct =
    video.similarity_score != null
      ? `${(video.similarity_score * 100).toFixed(0)}%`
      : "—";
  const source = video.match_source
    ? labels[video.match_source] ?? video.match_source
    : null;

  return (
    <div className="space-y-0.5 text-primary">
      <div>{pct}</div>
      {source && <div className="text-xs text-muted-foreground">{source}</div>}
      {video.transcript_similarity != null && video.transcript_similarity > 0 && (
        <div className="text-xs text-muted-foreground">
          transcript {(video.transcript_similarity * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}
