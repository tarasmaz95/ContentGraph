/** Hook Intelligence types — mirror backend hooks schemas */

import type { ChartPoint, HookTypeStat, PatternStat } from "@/types/analytics";

export interface HookPattern {
  id: number;
  video_id?: number | null;
  hook_text: string;
  hook_type: string;
  creator_name: string;
  views_count: number;
  video_title: string;
  effectiveness_score: number;
  confidence_score: number;
  keywords: string[];
  emotional_triggers: string[];
  created_at?: string | null;
}

export interface HookCharts {
  hook_type_distribution: ChartPoint[];
  avg_views_by_type: ChartPoint[];
  creator_hook_comparison: ChartPoint[];
  emotional_trigger_frequency: ChartPoint[];
}

export interface HookWorkspace {
  top_hooks: HookPattern[];
  viral_patterns: PatternStat[];
  best_performing: HookPattern[];
  categories: HookTypeStat[];
  emotional_triggers: PatternStat[];
  trends: string[];
  charts: HookCharts;
  total_hooks: number;
}

export interface HookSearchResult {
  pattern: HookPattern;
  relevance: number;
}

export interface HookGenerateRequest {
  creator_name?: string;
  topic: string;
  hook_type: string;
  tone: string;
}

export interface HookGenerateResult {
  creator_name: string;
  topic: string;
  hook_type: string;
  tone: string;
  hooks: string[];
  style_notes: string;
  used_placeholder?: boolean;
}

export interface HookCompareRequest {
  creators: string[];
  hook_types: string[];
}

export interface HookCompareResult {
  summary: string;
  creator_stats: Array<{
    creator_name: string;
    hook_count: number;
    avg_effectiveness: number;
    avg_views: number;
    top_hook_type: string;
  }>;
  hook_type_stats: HookTypeStat[];
  top_triggers: string[];
  recommendations: string[];
}

export const HOOK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "curiosity", label: "Curiosity" },
  { value: "urgency", label: "Urgency" },
  { value: "transformation", label: "Transformation" },
  { value: "authority", label: "Authority" },
  { value: "fear_loss", label: "Fear / Loss" },
  { value: "identity", label: "Identity" },
  { value: "contrarian", label: "Contrarian" },
  { value: "prediction", label: "Prediction" },
  { value: "social_proof", label: "Social Proof" },
  { value: "how_to", label: "How-To" },
];

export const HOOK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  HOOK_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);
