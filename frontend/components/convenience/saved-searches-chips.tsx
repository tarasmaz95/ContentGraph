"use client";

import { useEffect, useState } from "react";
import { Bookmark, X } from "lucide-react";

import {
  addSavedSearch,
  getSavedSearches,
  removeSavedSearch,
  type SavedSearch,
} from "@/lib/convenience-storage";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface SavedSearchesChipsProps {
  onRunSemantic?: (query: string) => void;
  onRunCompare?: (a: string, b: string) => void;
  currentSemanticQuery?: string;
  showSaveSemantic?: boolean;
}

export function SavedSearchesChips({
  onRunSemantic,
  onRunCompare,
  currentSemanticQuery = "",
  showSaveSemantic = true,
}: SavedSearchesChipsProps) {
  const t = useT();
  const [items, setItems] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setItems(getSavedSearches());
  }, []);

  const saveCurrent = () => {
    const q = currentSemanticQuery.trim();
    if (!q) return;
    setItems(addSavedSearch("semantic", q.slice(0, 40), q));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSaveSemantic && currentSemanticQuery.trim() && onRunSemantic && (
        <Button type="button" variant="ghost" size="sm" onClick={saveCurrent} className="gap-1">
          <Bookmark className="h-3.5 w-3.5" />
          {t("convenience.saveSearch")}
        </Button>
      )}
      {items.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
        >
          <button
            type="button"
            className="hover:text-primary"
            onClick={() => {
              if (s.kind === "semantic" && onRunSemantic) onRunSemantic(s.value);
              else if (s.kind === "compare" && onRunCompare) {
                const [a, b] = s.value.split("|");
                if (a && b) onRunCompare(a, b);
              }
            }}
          >
            {s.label}
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setItems(removeSavedSearch(s.id))}
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
