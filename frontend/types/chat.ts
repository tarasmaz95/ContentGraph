import type { StructuredAnalytics } from "@/types/analytics";

export interface ChatRequest {
  message: string;
}

export interface VideoSnapshot {
  id: number;
  creator_name: string;
  title: string;
  views_count: number;
  subscribers_count: number;
  has_transcript?: boolean;
  transcript_snippet?: string | null;
  match_source?: string | null;
  similarity_score?: number | null;
}

export interface ChatResponse {
  reply: string;
  analysis_type: string;
  relevant_videos: VideoSnapshot[];
  insights: string[];
  structured: StructuredAnalytics;
  context_videos_used: number;
  suggestions: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  analysis_type?: string;
  relevant_videos?: VideoSnapshot[];
  insights?: string[];
  structured?: StructuredAnalytics;
  suggestions?: string[];
}

export const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  creator_analysis: "Creator Analysis",
  creator_profile: "Creator Profile",
  creator_comparison: "Creator Comparison",
  hook_analysis: "Hook Analysis",
  hook_generation: "Hook Generation",
  hook_comparison: "Hook Comparison",
  script_generation: "Script Generation",
  script_analysis: "Script Analysis",
  video_breakdown: "Video Breakdown",
  transcript_analysis: "Transcript Analysis",
  viral_analysis: "Viral Analysis",
  trend_analysis: "Trend Analysis",
  title_analysis: "Title Analysis",
  audience_analysis: "Audience Analysis",
  comments_analysis: "Comments Analysis",
  general_chat: "General Analytics",
};
