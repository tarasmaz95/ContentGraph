/** AI Script Intelligence types */

import type { HookPattern } from "@/types/hooks";

export interface ScriptStructure {
  opening_hook: string;
  intro: string;
  key_points: string[];
  transitions: string[];
  cta: string;
  closing: string;
  full_script: string;
}

export interface ScriptAnalytics {
  estimated_engagement: number;
  hook_strength: number;
  emotional_triggers: string[];
  creator_similarity: number;
  readability: number;
  notes: string;
}

export interface ScriptGenerateRequest {
  creator_name: string;
  topic: string;
  tone: string;
  duration: string;
  hook_type: string;
}

export interface ScriptGenerateResult {
  creator_name: string;
  topic: string;
  tone: string;
  duration: string;
  hook_type: string;
  selected_hook: string;
  structure: ScriptStructure;
  analytics: ScriptAnalytics;
  viral_hooks_used: string[];
  style_notes: string;
}

export interface ScriptAnalyzeRequest {
  creator_name?: string;
  script_text?: string;
  topic?: string;
}

export interface ScriptAnalyzeResult {
  creator_name: string;
  summary: string;
  structure_detected: ScriptStructure;
  analytics: ScriptAnalytics;
  recommendations: string[];
}

export interface ScriptCompareRequest {
  creator_name: string;
  generated_script: string;
  topic?: string;
}

export interface ScriptCompareResult {
  summary: string;
  style_alignment: string;
  hook_alignment: string;
  gaps: string[];
  strengths: string[];
  top_video_references: string[];
}

export interface CreatorStyleContext {
  creator_name: string;
  content_style: string;
  communication_style: string;
  top_topics: string[];
  hook_patterns: string[];
  vocabulary: string[];
  sample_titles: string[];
  transcript_excerpts: string[];
}

export interface ScriptWorkspace {
  creators: string[];
  default_structure: ScriptStructure;
  viral_hooks: HookPattern[];
  creator_style: CreatorStyleContext | null;
  structure_template_notes: string;
}

export interface GeneratedScriptEntry {
  id: string;
  result: ScriptGenerateResult;
  createdAt: string;
}
