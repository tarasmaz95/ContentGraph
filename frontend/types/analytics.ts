/** Structured analytics types — mirror backend Pydantic schemas */

export interface AnalyticsMetrics {
  total_videos: number;
  avg_views: number;
  median_views: number;
  max_views: number;
  avg_title_length: number;
  titles_with_numbers_pct: number;
  how_to_titles_pct: number;
  curiosity_titles_pct: number;
  emotional_titles_pct: number;
}

export interface KeywordStat {
  keyword: string;
  count: number;
  avg_views: number;
}

export interface PatternStat {
  pattern: string;
  count: number;
  avg_views: number;
}

export interface HookTypeStat {
  hook_type: string;
  count: number;
  avg_views: number;
}

export interface CreatorStat {
  creator_name: string;
  video_count: number;
  total_views: number;
  avg_views: number;
}

export interface TitleAnalysis {
  top_patterns: string[];
  emotional_keywords: string[];
  best_performing_keywords: KeywordStat[];
  common_structures: string[];
  avg_views: number;
  recommendations: string[];
}

export interface CreatorAnalysis {
  creator_name: string;
  top_topics: string[];
  best_hooks: string[];
  content_style: string;
  avg_views: number;
  top_performing_titles: string[];
  recommendations: string[];
}

export interface TrendAnalysis {
  trending_topics: string[];
  rising_keywords: KeywordStat[];
  fastest_growing_creators: string[];
  viral_patterns: string[];
}

export interface HookAnalysis {
  hook_types: HookTypeStat[];
  top_hooks: string[];
  curiosity_patterns: PatternStat[];
  transformation_hooks: PatternStat[];
  urgency_hooks: PatternStat[];
  avg_views: number;
  recommendations: string[];
}

export interface CreatorProfileIntel {
  creator_name: string;
  content_style: string;
  top_topics: string[];
  hook_patterns: string[];
  communication_style: string;
  emotional_triggers: string[];
  audience_type: string;
  creator_summary: string;
  strategic_insights: string[];
  avg_views: number;
  total_videos: number;
}

export interface CreatorComparisonResult {
  creators: string[];
  summary: string;
  style_comparison: string;
  hook_comparison: string[];
  topic_comparison: string[];
  positioning_comparison: string[];
  communication_comparison: string[];
  recommendations: string[];
}

export interface HookGenerationIntel {
  topic: string;
  hook_type: string;
  hooks: string[];
  style_notes: string;
  recommendations: string[];
}

export interface HookComparisonIntel {
  summary: string;
  hook_type_stats: HookTypeStat[];
  creator_leaders: string[];
  recommendations: string[];
}

import type { ScriptAnalytics, ScriptStructure } from "@/types/scripts";
import type {
  StructureAnalysis,
  TranscriptIntelligence,
  VideoBreakdown,
  ViralAnalysis,
} from "@/types/video-intelligence";

export interface ScriptGenerationIntel {
  topic: string;
  creator_name: string;
  selected_hook: string;
  structure: ScriptStructure;
  analytics: ScriptAnalytics;
  style_notes: string;
  recommendations: string[];
}

export interface ScriptAnalysisIntel {
  summary: string;
  analytics: ScriptAnalytics;
  recommendations: string[];
  structure_notes: string;
}

export interface StructuredAnalytics {
  analysis_type: string;
  metrics: AnalyticsMetrics;
  title?: TitleAnalysis | null;
  creator?: CreatorAnalysis | null;
  trend?: TrendAnalysis | null;
  hook?: HookAnalysis | null;
  creator_profile?: CreatorProfileIntel | null;
  creator_comparison?: CreatorComparisonResult | null;
  hook_generation?: HookGenerationIntel | null;
  hook_comparison?: HookComparisonIntel | null;
  script_generation?: ScriptGenerationIntel | null;
  script_analysis?: ScriptAnalysisIntel | null;
  video_breakdown?: VideoBreakdownIntel | null;
  transcript_analysis?: TranscriptAnalysisIntel | null;
  viral_analysis?: ViralAnalysisIntel | null;
}

export interface VideoBreakdownIntel {
  video_id: number;
  title: string;
  breakdown: VideoBreakdown;
  structure: StructureAnalysis;
}

export interface TranscriptAnalysisIntel {
  video_id: number;
  transcript_intel: TranscriptIntelligence;
  recommendations: string[];
}

export interface ViralAnalysisIntel {
  video_id: number;
  viral: ViralAnalysis;
  summary: string;
}

export interface ChartPoint {
  label: string;
  value: number;
  count: number;
}

export interface DashboardCharts {
  views_distribution: ChartPoint[];
  keyword_frequency: ChartPoint[];
  creator_comparison: ChartPoint[];
  hook_type_distribution: ChartPoint[];
  title_length_vs_views: ChartPoint[];
}

export interface DashboardAnalytics {
  metrics: AnalyticsMetrics;
  top_patterns: string[];
  viral_keywords: KeywordStat[];
  best_hook_types: HookTypeStat[];
  top_creators: CreatorStat[];
  trending_topics: string[];
  charts: DashboardCharts;
  title_analysis: TitleAnalysis;
  hook_analysis: HookAnalysis;
  trend_analysis: TrendAnalysis;
}
