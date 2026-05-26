import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  MessageCircle,
  Sparkles,
  Table2,
  Upload,
  Zap,
} from "lucide-react";

import type { SyncRunMode, SyncRunStage } from "@/types/sync-run";

export const STAGE_ORDER_FULL: SyncRunStage[] = [
  "reading_sheet",
  "saving_videos",
  "analyzing_titles",
  "processing_transcripts",
  "finding_hook_patterns",
  "syncing_comments",
  "finalizing",
];

export const STAGE_ORDER_QUICK: SyncRunStage[] = [
  "reading_sheet",
  "saving_videos",
  "analyzing_titles",
  "finding_hook_patterns",
  "finalizing",
];

export const STAGE_ICONS: Record<string, LucideIcon> = {
  queued: Upload,
  reading_sheet: Table2,
  saving_videos: Upload,
  analyzing_titles: Sparkles,
  processing_transcripts: FileText,
  finding_hook_patterns: BookOpen,
  syncing_comments: MessageCircle,
  finalizing: Zap,
};

export function stagesForMode(mode: SyncRunMode): SyncRunStage[] {
  return mode === "quick" ? STAGE_ORDER_QUICK : STAGE_ORDER_FULL;
}

export function stageIndex(stage: string, mode: SyncRunMode): number {
  const order = stagesForMode(mode);
  const idx = order.indexOf(stage as SyncRunStage);
  return idx >= 0 ? idx : 0;
}

export function remainingStageCount(stage: string, mode: SyncRunMode): number {
  const order = stagesForMode(mode);
  const idx = order.indexOf(stage as SyncRunStage);
  if (idx < 0) return order.length;
  return Math.max(0, order.length - idx - 1);
}
