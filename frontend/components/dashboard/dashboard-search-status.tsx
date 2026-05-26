"use client";

import { Sparkles, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export type DashboardSearchKind = "semantic" | "keyword";

interface DashboardSearchStatusProps {
  query: string;
  kind: DashboardSearchKind;
  resultCount: number;
  onClear: () => void;
}

/** Active search context — query label, match count, clear action */
export function DashboardSearchStatus({
  query,
  kind,
  resultCount,
  onClear,
}: DashboardSearchStatusProps) {
  const t = useT();
  const Icon = kind === "semantic" ? Sparkles : Search;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          {kind === "semantic"
            ? t("dashboard.searchMode.semanticLabel")
            : t("dashboard.searchMode.keywordLabel")}
        </p>
        <p className="truncate text-sm font-medium text-foreground">&ldquo;{query}&rdquo;</p>
        <p className="text-xs text-muted-foreground">
          {t("dashboard.searchMode.resultCount", { count: resultCount })}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onClear} className="shrink-0">
        <X className="mr-1.5 h-3.5 w-3.5" />
        {t("dashboard.searchMode.clear")}
      </Button>
    </div>
  );
}
