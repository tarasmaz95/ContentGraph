"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import { HookToolGuide } from "@/components/hooks/hook-tool-guide";
import { searchHooks } from "@/services/api";
import type { HookSearchResult } from "@/types/hooks";
import { HookPatternList } from "@/components/hooks/hook-pattern-list";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const SEARCH_EXAMPLE_KEYS = [
  "hooks.searchExIdentity",
  "hooks.searchExAi",
  "hooks.searchExContrarian",
  "hooks.searchExCuriosity",
] as const;

/** Keyword search across indexed hooks from synced videos */
export function HookSearch() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    setLoading(true);
    setError(null);
    try {
      setResults(await searchHooks(text, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("hooks.searchFailed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          {t("hooks.searchTitle")}
        </CardTitle>
        <CardDescription>{t("hooks.searchDesc")}</CardDescription>
        <HookToolGuide variant="search" />
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("hooks.searchPlaceholder")}
            className="flex-1"
          />
          <Button type="submit" size="lg" disabled={loading} className="shrink-0 px-4">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("hooks.searchExamples")}</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_EXAMPLE_KEYS.map((key) => (
              <Button key={key} variant="outline" size="sm" onClick={() => void run(t(key))}>
                {t(key)}
              </Button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {results.length > 0 && (
          <HookPatternList
            patterns={results.map((r) => r.pattern)}
            saveTitle={`Hook search: ${query}`}
            showSaveCollection
          />
        )}
      </CardContent>
    </Card>
  );
}
