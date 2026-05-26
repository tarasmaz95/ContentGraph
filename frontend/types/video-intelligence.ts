/** Video Intelligence types */

import type { ChartPoint, KeywordStat } from "@/types/analytics";
import type { Video } from "@/types/video";

export interface VideoOverview {
  id: number;
  title: string;
  creator_name: string;
  channel_url: string;
  views_count: number;
  subscribers_count: number;
  published_at?: string | null;
  has_transcript: boolean;
  has_comments: boolean;
  comment_count: number;
  hook_types: string[];
  primary_hook_type: string;
  semantic_score?: number | null;
  performance_tier: string;
}

export interface KeyMoment {
  label: string;
  excerpt: string;
  start_pct: number;
}

export interface TranscriptIntelligence {
  preview: string;
  full_available: boolean;
  key_moments: KeyMoment[];
  strongest_insights: string[];
  repeated_themes: string[];
  cta_sections: string[];
  emotional_phrases: string[];
}

export interface StructureSection {
  section: string;
  summary: string;
  start_pct: number;
  end_pct: number;
}

export interface StructureAnalysis {
  hook: string;
  intro: string;
  key_sections: StructureSection[];
  transitions: string[];
  cta: string;
  closing: string;
}

export interface VideoBreakdown {
  why_performed: string;
  hook_effectiveness: string;
  emotional_triggers: string[];
  storytelling_patterns: string[];
  pacing: string;
  communication_style: string;
  cta_patterns: string[];
  audience_targeting: string;
  recommendations: string[];
}

export interface ViralAnalysis {
  viral_factors: string[];
  reusable_frameworks: string[];
  top_keywords: KeywordStat[];
  emotional_triggers: string[];
  creator_patterns: string[];
}

export interface SimilarVideoItem {
  id: number;
  title: string;
  creator_name: string;
  views_count: number;
  similarity_score: number;
  match_source?: string | null;
  shared_hook_type?: string | null;
}

export interface VideoCharts {
  topic_frequency: ChartPoint[];
  emotional_distribution: ChartPoint[];
  structure_timeline: ChartPoint[];
  keyword_frequency: ChartPoint[];
}

export interface CommentRead {
  id: number;
  video_id: number;
  comment_text: string;
  author_name: string;
  likes_count: number;
  published_at?: string | null;
  sentiment: string;
  emotional_tags: string[];
}

export interface CommentCharts {
  sentiment_distribution: ChartPoint[];
  emotional_triggers: ChartPoint[];
  question_frequency: ChartPoint[];
  recurring_phrases: ChartPoint[];
}

export interface CommentsIntelligence {
  total_comments: number;
  top_comments: CommentRead[];
  audience_reactions: string[];
  emotional_patterns: string[];
  questions: string[];
  pain_points: string[];
  audience_desires: string[];
  confusion_points: string[];
  recurring_phrases: string[];
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
  charts: CommentCharts;
  summary: string;
}

export interface VideoIntelligence {
  video: Video;
  overview: VideoOverview;
  breakdown: VideoBreakdown;
  transcript_intel: TranscriptIntelligence;
  structure: StructureAnalysis;
  viral: ViralAnalysis;
  similar_videos: SimilarVideoItem[];
  charts: VideoCharts;
  comments: CommentsIntelligence;
}
