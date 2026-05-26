export interface CreatorListItem {
  creator_name: string;
  total_videos: number;
  avg_views: number;
  has_profile: boolean;
  creator_summary: string;
}

export interface CreatorProfile {
  creator_name: string;
  content_style: string;
  top_topics: string[];
  hook_patterns: string[];
  communication_style: string;
  emotional_triggers: string[];
  audience_type: string;
  creator_summary: string;
  avg_views: number;
  total_videos: number;
  total_views: number;
  updated_at?: string | null;
}

export interface CreatorComparisonRequest {
  creators: string[];
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
