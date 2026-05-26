"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { fetchVideoById } from "@/services/api";
import type { Video } from "@/types/video";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface VideoDetailPanelProps {
  videoId: number | null;
  onClose: () => void;
}

/** Slide-in detail with full transcript */
export function VideoDetailPanel({ videoId, onClose }: VideoDetailPanelProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (videoId == null) {
      setVideo(null);
      return;
    }
    setLoading(true);
    fetchVideoById(videoId)
      .then(setVideo)
      .catch(() => setVideo(null))
      .finally(() => setLoading(false));
  }, [videoId]);

  if (videoId == null) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="text-base line-clamp-2">{video?.title ?? "Video"}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
        {video && (
          <>
            <p className="text-muted-foreground">{video.creator_name}</p>
            <p>{video.views_count.toLocaleString()} views</p>
            {video.transcript ? (
              <div className="max-h-48 overflow-y-auto rounded border bg-muted/30 p-3 text-xs leading-relaxed">
                {video.transcript}
              </div>
            ) : (
              <p className="text-muted-foreground">No transcript — sync may still be fetching.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
