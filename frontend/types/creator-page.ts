/** Creator intelligence page types — mirror backend creator_page schemas */

import type {
  HookAnalysis,
  HookTypeStat,
  KeywordStat,
  TitleAnalysis,
} from "@/types/analytics";
import type { Video } from "@/types/video";

export interface ChartPoint {
  label: string;
  value: number;
  count: number;
}

export interface TopVideoSummary {
  id: number;
  title: string;
  views_count: number;
  published_at?: string | null;
}

export interface CreatorOverview {
  creator_name: string;
  slug: string;
  subscribers_count: number;
  channel_url: string;
  total_videos: number;
  avg_views: number;
  total_views: number;
  top_video: TopVideoSummary | null;
  upload_timeline: ChartPoint[];
}

export interface CreatorCharts {
  views_over_time: ChartPoint[];
  hook_distribution: ChartPoint[];
  keyword_frequency: ChartPoint[];
  title_length_vs_views: ChartPoint[];
  upload_frequency: ChartPoint[];
}

export interface CreatorPageSections {
  top_videos: Video[];
  hook_analysis: HookAnalysis;
  topic_clusters: string[];
  viral_keywords: KeywordStat[];
  content_patterns: string[];
  title_structures: string[];
  title_analysis: TitleAnalysis;
  best_hook_types: HookTypeStat[];
}

export interface CreatorPageAnalytics {
  overview: CreatorOverview;
  charts: CreatorCharts;
  sections: CreatorPageSections;
}
