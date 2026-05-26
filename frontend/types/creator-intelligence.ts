/** Creator intelligence dashboard — mirrors backend /creators/{name}/intelligence */

import type { HookAnalysis } from "@/types/analytics";
import type { CommentRead } from "@/types/video-intelligence";
import type { ChartPoint, CreatorOverview, CreatorPageSections } from "@/types/creator-page";
import type { Video } from "@/types/video";

export interface CreatorGrowthMetrics {
  growth_7d_pct: number;
  growth_30d_pct: number;
  subscribers_delta_7d: number;
  views_delta_7d: number;
  velocity_views_per_day: number;
  snapshot_days: number;
  accelerating: boolean;
  slowing: boolean;
}

export interface CreatorGrowthIntel {
  metrics: CreatorGrowthMetrics;
  subscriber_history: ChartPoint[];
  views_history: ChartPoint[];
  upload_momentum: ChartPoint[];
  latest_snapshot_date: string | null;
}

export interface CreatorHookMix {
  curiosity_pct: number;
  transformation_pct: number;
  urgency_pct: number;
  numbers_pct: number;
  emotional_pct: number;
  authority_pct: number;
  how_to_pct: number;
  identity_pct: number;
}

export interface CreatorHookIntel {
  mix: CreatorHookMix;
  analysis: HookAnalysis;
  best_performing_hooks: string[];
}

export interface CreatorAudienceIntel {
  total_comments: number;
  top_comments: CommentRead[];
  repeated_phrases: string[];
  emotional_patterns: string[];
  pain_points: string[];
  top_reactions: string[];
}

export interface NearestCreator {
  creator_name: string;
  overlap_score: number;
  shared_topics: string[];
}

export interface CreatorSemanticIntel {
  dominant_keywords: { keyword: string; count: number; avg_views: number }[];
  themes: string[];
  positioning_summary: string;
  nearest_creators: NearestCreator[];
}

export interface VideoBreakoutItem {
  video_id: number;
  title: string;
  creator_name: string;
  views_now: number;
  views_delta_7d: number;
  growth_7d_pct: number;
  velocity_views_per_day: number;
  breakout_score: number;
}

export interface CreatorMomentumIntel {
  breakout_videos: VideoBreakoutItem[];
  fastest_growing: VideoBreakoutItem[];
  latest_uploads: Video[];
}

export interface CreatorIntelligence {
  overview: CreatorOverview;
  growth: CreatorGrowthIntel;
  hooks: CreatorHookIntel;
  audience: CreatorAudienceIntel;
  semantic: CreatorSemanticIntel;
  momentum: CreatorMomentumIntel;
  sections: CreatorPageSections;
}
