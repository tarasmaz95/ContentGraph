"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

import { CopyButton } from "@/components/convenience/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { fetchVideoById } from "@/services/api";
import type { Video } from "@/types/video";

/** Public full transcript view — linked from Google Sheets Full Transcript column. */
export default function TranscriptPage() {
  const params = useParams();
  const videoId = parseInt((params.id as string) ?? "", 10);

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!videoId || Number.isNaN(videoId)) {
      setError("Invalid video id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVideoById(videoId);
      setVideo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transcript");
      setVideo(null);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Video not found"}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const transcript = (video.transcript || "").trim();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-16">
      <Link
        href={`/videos/${video.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Video intelligence
      </Link>

      <PageHeader
        icon={FileText}
        title={video.title}
        description={`${video.creator_name}${video.published_at ? ` · ${video.published_at.slice(0, 10)}` : ""}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {video.video_url ? (
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            Watch on YouTube
          </a>
        ) : null}
        {transcript ? (
          <CopyButton text={transcript} label="Copy transcript" variant="outline" />
        ) : null}
      </div>

      {transcript ? (
        <article className="rounded-lg border bg-card p-6">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {transcript}
          </pre>
        </article>
      ) : (
        <p className="text-sm text-muted-foreground">
          No transcript saved for this video yet. Use the Chrome extension on YouTube to extract
          and save a transcript.
        </p>
      )}
    </div>
  );
}
