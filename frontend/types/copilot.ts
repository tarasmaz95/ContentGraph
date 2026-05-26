/** AI Copilot types */

export interface SmartInsight {
  id: string;
  text: string;
  category: string;
  priority: string;
  href?: string | null;
  hook_type?: string | null;
  outperform_pct?: number | null;
  avg_views?: number | null;
  baseline_avg_views?: number | null;
  pattern_count?: number | null;
  topic?: string | null;
  keyword?: string | null;
  keyword_video_count?: number | null;
  creator_name?: string | null;
}

export interface CopilotRecommendation {
  label: string;
  description: string;
  href: string;
  kind: string;
}

export interface AIBrief {
  brief_type: string;
  title: string;
  headline: string;
  bullets: string[];
  actions: string[];
  catalog_total?: number | null;
  sample_size?: number | null;
}

export interface CopilotPanelResponse {
  context: string;
  smart_insights: SmartInsight[];
  recommendations: CopilotRecommendation[];
  brief?: AIBrief | null;
  catalog_video_count: number;
  hook_patterns_count: number;
  analytics_sample_size: number;
}

export interface FeedEvidenceVideo {
  video_id: number;
  title: string;
  creator_name: string;
  views_count?: number | null;
}

export interface FeedBriefingMeta {
  signals_considered: number;
  signals_selected: number;
  min_final_score: number;
  snapshot_date_latest?: string | null;
  snapshot_days_max?: number | null;
  comment_count: number;
  has_snapshot_history: boolean;
}

export interface FeedItem {
  id: string;
  category: string;
  section: string;
  title: string;
  summary: string;
  description?: string;
  why_appeared?: string;
  why_matters?: string;
  href?: string | null;
  badge?: string | null;
  created_label: string;
  creator_name?: string | null;
  views_count?: number | null;
  video_count?: number | null;
  avg_views?: number | null;
  hook_type?: string | null;
  performance_ratio?: number | null;
  audience_theme?: string | null;
  confidence_score?: number;
  importance_score?: number;
  actionability_score?: number;
  freshness_score?: number;
  final_score?: number;
  evidence_count?: number;
  supporting_videos?: FeedEvidenceVideo[];
  supporting_creators?: string[];
  time_window?: string;
  snapshot_days?: number | null;
  keyword?: string | null;
}

export interface IntelligenceFeedResponse {
  items: FeedItem[];
  generated_at: string;
  catalog_video_count: number;
  briefing: FeedBriefingMeta;
  keyword_sample_size: number;
}

export interface PersonalizationInput {
  recent_searches: string[];
  viewed_creators: string[];
  saved_tags: string[];
  viewed_video_ids: number[];
}

export interface ResearchAssistantHints {
  related_insights: string[];
  suggested_tags: string[];
  related_creators: string[];
  related_video_ids: number[];
}
