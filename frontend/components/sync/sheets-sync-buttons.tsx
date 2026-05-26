"use client";

import { ChevronDown, Loader2, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useSheetsSync } from "@/components/sync/sheets-sync-context";
import type { SyncRunMode } from "@/types/sync-run";

interface SheetsSyncButtonsProps {
  layout?: "inline" | "stacked";
}

/** Full sync (YouTube enrich) temporarily off — UI stays visible. */
const FULL_SYNC_ENABLED = false;

/** Quick (primary) + Full sync (secondary) with short explanations. */
export function SheetsSyncButtons({ layout = "inline" }: SheetsSyncButtonsProps) {
  const t = useT();
  const { startSync, isActive, isStarting } = useSheetsSync();
  const [menuOpen, setMenuOpen] = useState(false);
  const busy = isActive || isStarting;
  const fullSyncDisabled = busy || !FULL_SYNC_ENABLED;

  const run = (mode: SyncRunMode) => {
    setMenuOpen(false);
    void startSync(mode);
  };

  if (layout === "stacked") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button onClick={() => run("quick")} disabled={busy} className="w-full sm:w-auto">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {t("sheetsSync.mode.quick")}
        </Button>
        <Button
          variant="outline"
          onClick={() => run("full")}
          disabled={fullSyncDisabled}
          title={!FULL_SYNC_ENABLED ? t("sheetsSync.mode.fullDisabled") : undefined}
          className="w-full sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" />
          {t("sheetsSync.mode.full")}
        </Button>
        <p className="text-xs text-muted-foreground sm:max-w-xs">
          {t("sheetsSync.mode.hint")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => run("quick")} disabled={busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        {t("sheetsSync.mode.quick")}
      </Button>
      <div className="relative">
        <Button
          variant="outline"
          disabled={fullSyncDisabled}
          title={!FULL_SYNC_ENABLED ? t("sheetsSync.mode.fullDisabled") : undefined}
          onClick={() => {
            if (!FULL_SYNC_ENABLED) return;
            setMenuOpen((o) => !o);
          }}
          className="gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          {t("sheetsSync.mode.full")}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
        {menuOpen && FULL_SYNC_ENABLED && !busy && (
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card p-3 text-xs shadow-lg">
            <p className="font-medium text-foreground">{t("sheetsSync.mode.full")}</p>
            <p className="mt-1 text-muted-foreground">{t("sheetsSync.mode.fullDesc")}</p>
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={() => run("full")}
            >
              {t("sheetsSync.mode.startFull")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
