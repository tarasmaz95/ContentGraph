"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Film } from "lucide-react";

import { SaveInsightButton } from "@/components/research/save-insight-button";
import { SimilarVideos } from "@/components/videos/similar-videos";
import { StructureAnalysis } from "@/components/videos/structure-analysis";
import { TranscriptIntelligence } from "@/components/videos/transcript-intelligence";
import { VideoBreakdown } from "@/components/videos/video-breakdown";
import { CommentsIntelligenceSection } from "@/components/videos/comments-intelligence";
import { VideoChartsPanel } from "@/components/videos/video-charts";
import { VideoOverview } from "@/components/videos/video-overview";
import { ViralAnalysis } from "@/components/videos/viral-analysis";
import {
  formatAudienceInsightsForSave,
  formatCommentPatternsForSave,
  formatTranscriptInsightsForSave,
  formatVideoAnalysisForSave,
  formatViralFrameworksForSave,
} from "@/lib/research-format";
import { trackVideoView } from "@/lib/personalization";
import { fetchVideoIntelligence } from "@/services/api";
import type { VideoIntelligence } from "@/types/video-intelligence";
import { Button } from "@/components/ui/button";

/**
 * Video Intelligence — /videos/[id]
 *
 * Deep breakdown, transcript intelligence, structure, viral analysis, similar videos.
 */
export default function VideoIntelligencePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const highlightQuery = searchParams.get("highlight")?.trim() ?? "";
  const videoId = parseInt((params.id as string) ?? "", 10);

  const [intel, setIntel] = useState<VideoIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!videoId || Number.isNaN(videoId)) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchVideoIntelligence(videoId, refresh);
        setIntel(data);
        trackVideoView(videoId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load video");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [videoId],
  );

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

  if (error || !intel) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? "Video not found"}
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-primary underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
            <Film className="h-7 w-7 text-primary" />
            Video Intelligence
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveInsightButton
            insightText={formatVideoAnalysisForSave(intel)}
            sourceType="video_analysis"
            sourceReference={intel.overview.title.slice(0, 80)}
            tags={[intel.overview.creator_name, "video"]}
            label="Save Analysis"
          />
          <SaveInsightButton
            insightText={formatTranscriptInsightsForSave(intel)}
            sourceType="transcript_insights"
            sourceReference={String(intel.overview.id)}
            tags={["transcript"]}
            label="Save Transcript Insights"
          />
          <SaveInsightButton
            insightText={formatViralFrameworksForSave(intel)}
            sourceType="viral_framework"
            sourceReference={intel.overview.title.slice(0, 80)}
            tags={["viral"]}
            label="Save Viral Frameworks"
          />
          <SaveInsightButton
            insightText={formatAudienceInsightsForSave(intel)}
            sourceType="audience_insights"
            sourceReference={String(intel.overview.id)}
            tags={[intel.overview.creator_name, "audience"]}
            label="Save Audience Insights"
          />
          <SaveInsightButton
            insightText={formatCommentPatternsForSave(intel)}
            sourceType="comment_patterns"
            sourceReference={intel.overview.title.slice(0, 80)}
            tags={["comments"]}
            label="Save Comment Patterns"
          />
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh AI
          </Button>
        </div>
      </header>

      <VideoOverview overview={intel.overview} />

      <div className="grid gap-6 lg:grid-cols-2">
        <VideoBreakdown breakdown={intel.breakdown} />
        <TranscriptIntelligence
          data={intel.transcript_intel}
          highlightQuery={highlightQuery}
        />
        <StructureAnalysis structure={intel.structure} />
        <ViralAnalysis viral={intel.viral} />
      </div>

      <CommentsIntelligenceSection data={intel.comments} />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Charts</h2>
        <VideoChartsPanel charts={intel.charts} />
      </section>

      <SimilarVideos videos={intel.similar_videos} />
    </div>
  );
}
