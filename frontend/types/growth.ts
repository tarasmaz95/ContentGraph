/** Historical growth analytics — mirrors backend /analytics growth endpoints */

export interface CreatorGrowthItem {
  creator_name: string;
  youtube_channel_id: string;
  subscribers_now: number;
  subscribers_delta_7d: number;
  subscribers_delta_30d: number;
  growth_7d_pct: number;
  growth_30d_pct: number;
  total_views_now: number;
  views_delta_7d: number;
  velocity_views_per_day: number;
  snapshot_days: number;
}

export interface CreatorGrowthResponse {
  items: CreatorGrowthItem[];
  snapshot_date_latest: string | null;
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

export interface VideoBreakoutsResponse {
  items: VideoBreakoutItem[];
}

export interface VelocityItem {
  video_id: number;
  title: string;
  creator_name: string;
  views_now: number;
  velocity_views_per_day: number;
  views_delta_7d: number;
}

export interface VelocityResponse {
  items: VelocityItem[];
}
