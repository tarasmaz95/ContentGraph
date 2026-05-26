/** Video entity — mirrors backend VideoRead / VideoDetail */

export interface Video {
  id: number;
  creator_name: string;
  channel_url: string;
  video_url?: string;
  subscribers_count: number;
  title: string;
  views_count: number;
  published_at: string | null;
  created_at: string;
  has_transcript: boolean;
  transcript_preview?: string | null;
  transcript?: string | null;
  similarity_score?: number | null;
  title_similarity?: number | null;
  transcript_similarity?: number | null;
  match_source?: string | null;
  transcript_snippet?: string | null;
}

export interface CatalogStats {
  video_count: number;
  title_embedding_count: number;
  transcript_embedding_count: number;
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
}

export interface SyncResult {
  created: number;
  updated: number;
  total_rows: number;
  embeddings_created: number;
  transcripts_fetched: number;
  transcript_embeddings_created: number;
  hooks_indexed: number;
  comments_fetched?: number;
}
