"use client";

import { CheckCircle2, Loader2, PauseCircle, PlayCircle, XCircle } from "lucide-react";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TranscriptApiIngestionRunStatus } from "@/types/transcript-api-ingestion";

const STYLES: Record<TranscriptApiIngestionRunStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  paused: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const ICONS: Record<TranscriptApiIngestionRunStatus, typeof Loader2> = {
  queued: PlayCircle,
  running: Loader2,
  paused: PauseCircle,
  completed: CheckCircle2,
  failed: XCircle,
};

export function RunStatusBadge({
  status,
  runId,
  className,
}: {
  status: TranscriptApiIngestionRunStatus;
  runId?: number;
  className?: string;
}) {
  const t = useT();
  const Icon = ICONS[status];
  const label = t(`transcriptApiIngestion.runStatus.${status}`);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STYLES[status],
        className,
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", status === "running" && "animate-spin")}
      />
      {label}
      {runId != null && (
        <span className="text-muted-foreground/80">#{runId}</span>
      )}
    </span>
  );
}
