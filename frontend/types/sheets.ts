/** Google Sheets connection UX API types */

export interface ParseSheetsUrlResponse {
  spreadsheet_id: string;
  spreadsheet_url: string;
  tabs: string[];
}

export interface SheetPreviewResponse {
  sheet_name: string;
  headers: string[];
  preview_rows: string[][];
  column_mapping: Record<string, string>;
  missing_required: string[];
  suggested_range: string;
}

export type SheetFieldKey =
  | "creator_name"
  | "title"
  | "channel_url"
  | "video_url"
  | "subscribers_count"
  | "views_count"
  | "published_at_raw"
  | "transcript"
  | "comments";

export const SHEET_FIELD_KEYS: SheetFieldKey[] = [
  "creator_name",
  "title",
  "channel_url",
  "video_url",
  "subscribers_count",
  "views_count",
  "published_at_raw",
  "transcript",
  "comments",
];

export const REQUIRED_SHEET_FIELDS: SheetFieldKey[] = ["creator_name", "title"];
