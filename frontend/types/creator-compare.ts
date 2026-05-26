/** Creator A vs B compare — GET /compare */

import type { CreatorIntelligence } from "@/types/creator-intelligence";
import type { ChartPoint } from "@/types/creator-page";

export interface CreatorCompareOverviewRow {
  signal: string;
  value_a: string;
  value_b: string;
  winner: string | null;
}

export interface TitleBattleItem {
  video_id: number;
  title: string;
  views_count: number;
  hook_type: string;
  title_length: number;
  curiosity_score: number;
}

export interface SemanticOverlapCompare {
  shared_themes: string[];
  unique_a: string[];
  unique_b: string[];
  overlap_score: number;
  summary: string;
}

export interface GrowthCompareSeries {
  subscriber_a: ChartPoint[];
  subscriber_b: ChartPoint[];
  views_a: ChartPoint[];
  views_b: ChartPoint[];
}

export interface CreatorCompareResult {
  creator_a: string;
  creator_b: string;
  intelligence_a: CreatorIntelligence;
  intelligence_b: CreatorIntelligence;
  overview_rows: CreatorCompareOverviewRow[];
  growth_compare: GrowthCompareSeries;
  semantic_overlap: SemanticOverlapCompare;
  title_battle_a: TitleBattleItem[];
  title_battle_b: TitleBattleItem[];
  momentum_winner: string | null;
  growth_winner: string | null;
  hooks_winner: string | null;
}
