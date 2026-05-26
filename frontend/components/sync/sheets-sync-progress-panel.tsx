"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Minimize2,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  elapsedSecondsSince,
  formatDurationSeconds,
} from "@/lib/format-duration";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  remainingStageCount,
  STAGE_ICONS,
  stageIndex,
  stagesForMode,
} from "@/lib/sheets-sync-stages";
import {
  isSyncRunActive,
  syncRunProgressPercent,
  type SyncRun,
  type SyncRunMode,
  type SyncRunStage,
  type SyncRunWarning,
} from "@/types/sync-run";
import { useSheetsSync } from "@/components/sync/sheets-sync-context";

const LONG_SYNC_SECONDS = 300;

function stageKey(stage: string): string {
  const known: SyncRunStage[] = [
    "queued",
    "reading_sheet",
    "saving_videos",
    "analyzing_titles",
    "processing_transcripts",
    "finding_hook_patterns",
    "syncing_comments",
    "finalizing",
  ];
  if (known.includes(stage as SyncRunStage)) {
    return `sheetsSync.stage.${stage}`;
  }
  return "sheetsSync.stage.unknown";
}

function groupWarnings(warnings: SyncRunWarning[]) {
  const byCode = new Map<string, SyncRunWarning[]>();
  for (const w of warnings) {
    const list = byCode.get(w.code) ?? [];
    list.push(w);
    byCode.set(w.code, list);
  }
  return [...byCode.entries()];
}

function StageStepper({
  run,
  mode,
}: {
  run: SyncRun;
  mode: SyncRunMode;
}) {
  const t = useT();
  const stages = stagesForMode(mode);
  const currentIdx = stageIndex(run.stage, mode);

  return (
    <ol className="space-y-1.5" aria-label={t("sheetsSync.stageList")}>
      {stages.map((key, idx) => {
        const done = run.status === "completed" || idx < currentIdx;
        const active = run.status !== "completed" && idx === currentIdx;
        const Icon = STAGE_ICONS[key] ?? Loader2;
        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
              active && "bg-primary/10 text-foreground",
              done && !active && "text-muted-foreground",
              !done && !active && "text-muted-foreground/50",
            )}
          >
            {done && !active ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : active ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-40" />
            )}
            <span className={cn(active && "font-medium")}>
              {t(stageKey(key))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SuccessHero({ run }: { run: SyncRun }) {
  const t = useT();
  const r = run.result ?? {};
  const duration =
    run.duration_seconds ??
    (run.finished_at ? elapsedSecondsSince(run.started_at) : null);

  const stats: { label: string; value: string }[] = [];
  const catalogCount = r.catalog_video_count ?? r.total_rows ?? 0;
  if (catalogCount > 0) {
    stats.push({
      label: t("sheetsSync.summary.videosLabel"),
      value: t("sheetsSync.summary.videos", { count: String(catalogCount) }),
    });
  }
  const sheetRows = r.sheet_rows ?? r.total_rows ?? 0;
  if (sheetRows > 0 && sheetRows !== catalogCount) {
    stats.push({
      label: t("sheetsSync.summary.sheetRowsLabel"),
      value: t("sheetsSync.summary.sheetRows", { count: String(sheetRows) }),
    });
  }
  const transcripts = r.transcripts_processed ?? r.transcripts_fetched ?? 0;
  if (transcripts > 0) {
    stats.push({
      label: t("sheetsSync.summary.transcriptsLabel"),
      value: t("sheetsSync.summary.transcripts", { count: String(transcripts) }),
    });
  }
  const discussions =
    r.audience_discussions_added ?? r.comments_fetched ?? 0;
  if (discussions > 0) {
    stats.push({
      label: t("sheetsSync.summary.discussionsLabel"),
      value: t("sheetsSync.summary.discussions", {
        count: String(discussions),
      }),
    });
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {t("sheetsSync.successHeadline")}
          </p>
          {run.warning_count > 0 && (
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
              {t("sheetsSync.successWithWarnings")}
            </p>
          )}
        </div>
      </div>
      {stats.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-emerald-500/20 pt-3">
          {stats.map((s) => (
            <li key={s.label} className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
      {duration != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("sheetsSync.summary.duration", {
            time: formatDurationSeconds(duration),
          })}
        </p>
      )}
    </div>
  );
}

function WarningsCollapsible({
  warnings,
  count,
}: {
  warnings: SyncRunWarning[];
  count: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupWarnings(warnings), [warnings]);

  if (count <= 0) return null;

  const blocked = groups.find(([code]) => code === "transcript_source_blocked");

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-amber-900 dark:text-amber-100"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1 font-medium">
          {blocked
            ? t("sheetsSync.warningsBlockedSummary")
            : t("sheetsSync.warnings", { count: String(count) })}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
        )}
      </button>
      {open && (
        <ul className="max-h-32 space-y-1 overflow-y-auto border-t border-amber-500/20 px-3 py-2 text-xs text-muted-foreground">
          {groups.map(([code, items]) => (
            <li key={code}>
              <span className="font-medium text-foreground">{code}</span>
              {items.length === 1 ? (
                <p className="truncate">{items[0].detail}</p>
              ) : (
                <p>{t("sheetsSync.warningGroup", { count: String(items.length) })}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SheetsSyncProgressPanel() {
  const t = useT();
  const {
    run,
    isActive,
    isStarting,
    isRecovering,
    panelOpen,
    openPanel,
    closePanel,
    startSync,
    lastError,
    clearLastError,
  } = useSheetsSync();

  if (!run && !lastError && !isStarting && !isRecovering) return null;

  const mode: SyncRunMode = run?.mode ?? "quick";
  const showFloatingPill = run && isActive && !panelOpen;
  const showPanel = panelOpen && (run || lastError || isStarting || isRecovering);

  const percent = run ? syncRunProgressPercent(run) : null;
  const indeterminate = run != null && (percent == null || run.total == null);
  const elapsedSec = run ? elapsedSecondsSince(run.started_at) : 0;
  const elapsed = formatDurationSeconds(elapsedSec);
  const isLongRun = isActive && elapsedSec >= LONG_SYNC_SECONDS;

  const remaining = run
    ? remainingStageCount(run.stage, mode)
    : 0;

  const title =
    run?.status === "completed"
      ? t("sheetsSync.titleComplete")
      : run?.status === "failed"
        ? t("sheetsSync.titleFailed")
        : isRecovering
          ? t("sheetsSync.titleReconnecting")
          : isStarting
            ? t("sheetsSync.titleStarting")
            : t("sheetsSync.title");

  const modeBadge =
    mode === "quick" ? t("sheetsSync.mode.quickShort") : t("sheetsSync.mode.fullShort");

  return (
    <>
      {showFloatingPill && (
        <button
          type="button"
          onClick={openPanel}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm transition hover:bg-accent sm:left-auto sm:right-4 sm:mx-0"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="truncate">{t("sheetsSync.reopen")}</span>
          {percent != null && (
            <span className="tabular-nums text-muted-foreground">{percent}%</span>
          )}
        </button>
      )}

      {showPanel && (
        <div
          className={cn(
            "fixed z-50 rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-sm transition-all",
            "bottom-4 left-4 right-4 max-h-[min(85vh,32rem)] overflow-hidden",
            "sm:left-auto sm:right-4 sm:w-[min(100vw-2rem,26rem)]",
            "animate-in fade-in slide-in-from-bottom-4 duration-200",
          )}
          role="dialog"
          aria-labelledby="sheets-sync-title"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="sheets-sync-title"
                  className="text-sm font-semibold leading-tight"
                >
                  {title}
                </h2>
                {run && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {modeBadge}
                  </span>
                )}
              </div>
              {run && isSyncRunActive(run) && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {t("sheetsSync.elapsed", { time: elapsed })}
                  {remaining > 0 &&
                    ` · ${t("sheetsSync.stagesRemaining", { count: String(remaining) })}`}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5">
              {run && isActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={closePanel}
                  aria-label={t("sheetsSync.minimize")}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0"
                onClick={closePanel}
                aria-label={t("sheetsSync.close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(min(85vh,32rem)-3.5rem)] space-y-3 overflow-y-auto px-4 py-3">
            {isRecovering && !run && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("sheetsSync.reconnecting")}
              </p>
            )}

            {isStarting && !run && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {t("sheetsSync.starting")}
              </p>
            )}

            {lastError && !run && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <div className="flex gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{lastError}</p>
                </div>
              </div>
            )}

            {run && run.status !== "completed" && run.status !== "failed" && (
              <>
                <StageStepper run={run} mode={mode} />

                <div className="space-y-1.5">
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                    {indeterminate ? (
                      <div className="absolute inset-y-0 w-2/5 rounded-full bg-primary animate-sheets-sync-bar" />
                    ) : (
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                        style={{ width: `${percent ?? 0}%` }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {run.total != null && run.total > 0
                      ? t("sheetsSync.progress", {
                          processed: String(run.processed),
                          total: String(run.total),
                        })
                      : t("sheetsSync.indeterminate")}
                  </p>
                  {run.current_entity_name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {t("sheetsSync.currentItem", {
                        name: run.current_entity_name,
                      })}
                    </p>
                  )}
                </div>

                {isLongRun && (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    {run.stage === "processing_transcripts"
                      ? t("sheetsSync.longRun.transcripts")
                      : t("sheetsSync.longRun.generic")}
                  </p>
                )}
              </>
            )}

            {run && run.status === "completed" && (
              <>
                <SuccessHero run={run} />
                <WarningsCollapsible
                  warnings={run.warnings}
                  count={run.warning_count}
                />
              </>
            )}

            {run && run.status === "failed" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-sm font-medium text-destructive">
                  {t("sheetsSync.failedHeadline")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {run.error_message ?? t("sheetsSync.failedGeneric")}
                </p>
              </div>
            )}

            {run && run.warning_count > 0 && run.status !== "completed" && (
              <WarningsCollapsible
                warnings={run.warnings}
                count={run.warning_count}
              />
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-2">
              {run?.status === "failed" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    clearLastError();
                    void startSync(run.mode ?? "quick");
                  }}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  {t("sheetsSync.retry")}
                </Button>
              )}
              {(run?.status === "completed" || run?.status === "failed") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={closePanel}
                >
                  {t("sheetsSync.dismiss")}
                </Button>
              )}
            </div>
          </div>

        </div>
      )}
    </>
  );
}
