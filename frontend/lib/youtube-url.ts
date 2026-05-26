import type { Video } from "@/types/video";

const WATCH_ID =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;

/** Parse 11-char YouTube video id from common URL shapes. */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url?.trim()) return null;
  const match = WATCH_ID.exec(url);
  if (match) return match[1];
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be") && parsed.pathname.length > 1) {
      const id = parsed.pathname.slice(1).split("/")[0];
      if (id.length === 11) return id;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v && v.length >= 11) return v.slice(0, 11);
    }
  } catch {
    return null;
  }
  return null;
}

function channelHandleFromUrl(channelUrl: string): string | null {
  const m = channelUrl.match(/youtube\.com\/@([A-Za-z0-9._-]+)/);
  return m ? m[1] : null;
}

/**
 * Best-effort YouTube URL for opening the video in a new tab.
 * Watch link when id is in channel_url; else channel-scoped or global search.
 */
export function getYouTubeOpenUrl(
  video: Pick<Video, "title" | "creator_name" | "channel_url" | "video_url">,
): string {
  const rawVideoUrl = (video.video_url ?? "").trim();
  if (rawVideoUrl) {
    const fromVideoUrl = extractYouTubeVideoId(rawVideoUrl);
    if (fromVideoUrl) {
      return `https://www.youtube.com/watch?v=${fromVideoUrl}`;
    }
    if (/^https?:\/\//i.test(rawVideoUrl)) {
      return rawVideoUrl;
    }
  }

  const ytId = extractYouTubeVideoId(video.channel_url);
  if (ytId) {
    return `https://www.youtube.com/watch?v=${ytId}`;
  }

  const handle = channelHandleFromUrl(video.channel_url);
  const q = encodeURIComponent(video.title.trim());
  if (handle) {
    return `https://www.youtube.com/@${handle}/search?query=${q}`;
  }

  const searchQ = encodeURIComponent(`${video.title} ${video.creator_name}`.trim());
  return `https://www.youtube.com/results?search_query=${searchQ}`;
}
