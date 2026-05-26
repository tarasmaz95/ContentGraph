"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { formatRelativeTime } from "@/lib/format-relative-time";
import { useLocale, useT } from "@/lib/i18n";
import type { LastSyncStatus } from "@/types/sync-run";

interface LastSyncBadgeProps {
  lastSync: LastSyncStatus | null;
  compact?: boolean;
}

/** Lightweight last-sync status for dashboard/settings. */
export function LastSyncBadge({ lastSync, compact = false }: LastSyncBadgeProps) {
  const t = useT();
  const { locale } = useLocale();

  if (!lastSync) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("sheetsSync.lastSync.never")}
      </span>
    );
  }

  const when = formatRelativeTime(lastSync.finished_at, locale);
  const modeLabel =
    lastSync.mode === "quick"
      ? t("sheetsSync.mode.quickShort")
      : t("sheetsSync.mode.fullShort");

  const catalog = lastSync.catalog_video_count.toLocaleString();
  const sheetRows = lastSync.sheet_rows.toLocaleString();

  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        {t("sheetsSync.lastSync.compact", { when, catalog, sheetRows })}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        {t("sheetsSync.lastSync.synced", { when })}
      </span>
      <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
        {t("sheetsSync.lastSync.catalogCount", { count: catalog })}
      </span>
      <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
        {t("sheetsSync.lastSync.sheetRows", { count: sheetRows })}
      </span>
      <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
        {modeLabel}
      </span>
      {lastSync.warning_count > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("sheetsSync.lastSync.warnings", {
            count: String(lastSync.warning_count),
          })}
        </span>
      )}
    </div>
  );
}
