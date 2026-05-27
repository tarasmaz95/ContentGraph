/**
 * Audience Intelligence — types for the persisted, refresh-driven layer.
 *
 * Distinct from `CommentsIntelligence` (which is computed per page load and
 * shipped inside `VideoIntelligence`). These objects come from
 * GET /videos/{id}/audience-insights and live in their own DB cache row.
 */

export interface AudienceTopic {
  label: string;
  weight: number;
}

export interface AudienceSentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface AudienceComment {
  id: number | null;
  author: string;
  text: string;
  likes_count: number;
  reply_count: number;
  is_pinned: boolean;
  is_hearted: boolean;
  score: number;
  sentiment: string;
  published_text?: string | null;
}

export interface AudienceInsights {
  video_id: number;
  summary: string;
  top_topics: AudienceTopic[];
  pain_points: string[];
  desires: string[];
  sentiment_distribution: AudienceSentimentDistribution;
  top_comments: AudienceComment[];
  comment_count_at_generation: number;
  total_comments: number;
  model_used: string;
  generated_at: string | null;
  is_empty: boolean;
}
