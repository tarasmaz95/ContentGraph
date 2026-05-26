export interface SavedInsight {
  id: number;
  insight_text: string;
  source_type: string;
  source_reference: string;
  tags: string[];
  created_at: string;
}

export interface SavedInsightCreate {
  insight_text: string;
  source_type: string;
  source_reference?: string;
  tags?: string[];
}

export interface ResearchNote {
  id: number;
  title: string;
  content: string;
  type: string;
  creator_name: string | null;
  tags: string[];
  created_at: string;
}

export interface ResearchNoteCreate {
  title: string;
  content: string;
  type?: string;
  creator_name?: string | null;
  tags?: string[];
}

export interface ResearchSearchResult {
  kind: "insight" | "note";
  id: number;
  title: string;
  snippet: string;
  creator_name?: string | null;
  tags: string[];
  source_type?: string | null;
}

export interface ResearchSummary {
  recent_insights: SavedInsight[];
  creator_findings: SavedInsight[];
  saved_comparisons: SavedInsight[];
  recent_notes: ResearchNote[];
  total_insights: number;
  total_notes: number;
}

export type ResearchItemType =
  | "creator_compare"
  | "creator_snapshot"
  | "hook"
  | "breakout_video"
  | "audience_insight"
  | "semantic_theme"
  | "feed_signal";

export interface ResearchCollection {
  id: number;
  name: string;
  created_at: string;
  item_count: number;
}

export interface ResearchItem {
  id: number;
  collection_id: number | null;
  type: ResearchItemType;
  title: string;
  payload_json: Record<string, unknown>;
  notes: string;
  tags: string[];
  created_at: string;
}

export interface ResearchItemCreate {
  type: ResearchItemType;
  title: string;
  payload_json: Record<string, unknown>;
  collection_id?: number | null;
  notes?: string;
  tags?: string[];
}

export interface ResearchItemUpdate {
  collection_id?: number | null;
  notes?: string;
  tags?: string[];
}

export interface ResearchWorkspace {
  insights: SavedInsight[];
  notes: ResearchNote[];
  creator_findings: SavedInsight[];
  comparisons: SavedInsight[];
  collections: ResearchCollection[];
  items: ResearchItem[];
  timeline: ResearchItem[];
}
