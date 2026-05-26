"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";

import { SaveInsightButton } from "@/components/research/save-insight-button";
import { useLocale, useT } from "@/lib/i18n";
import { compareHooks, fetchCreators } from "@/services/api";
import type { HookCompareResult } from "@/types/hooks";
import { HOOK_TYPE_OPTIONS } from "@/types/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Compare creators and hook types by effectiveness */
export function HookCompare() {
  const t = useT();
  const { locale } = useLocale();
  const [allCreators, setAllCreators] = useState<string[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [result, setResult] = useState<HookCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCreators = async () => {
    setLoadingList(true);
    try {
      const list = await fetchCreators();
      setAllCreators(list.map((c) => c.creator_name));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadCreators();
  }, []);

  const toggleCreator = (name: string) => {
    setSelectedCreators((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name].slice(0, 4),
    );
  };

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4),
    );
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      if (allCreators.length === 0) await loadCreators();
      const comparison = await compareHooks({
        creators: selectedCreators,
        hook_types: selectedTypes,
      });
      setResult(comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setLoading(false);
    }
  };

  const saveText = result
    ? [
        result.summary,
        "Creators:",
        ...result.creator_stats.map(
          (c) =>
            `• ${c.creator_name}: ${c.hook_count} hooks, eff ${(c.avg_effectiveness * 100).toFixed(0)}%`,
        ),
        "Recommendations:",
        ...result.recommendations.map((r) => `• ${r}`),
      ].join("\n")
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Hook Comparison</CardTitle>
        <CardDescription>Compare creators, hook types, effectiveness, and triggers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Creators</p>
          <div className="flex flex-wrap gap-2">
            {(allCreators.length ? allCreators : []).map((name) => (
              <Button
                key={name}
                size="sm"
                variant={selectedCreators.includes(name) ? "default" : "outline"}
                onClick={() => toggleCreator(name)}
              >
                {name}
              </Button>
            ))}
            {allCreators.length === 0 && (
              <div className="w-full rounded-xl border-2 border-primary/35 bg-primary/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">{t("creators.compareLoadTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("creators.compareLoadHint")}</p>
                {locale === "uk" && (
                  <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
                    {t("creators.compareLoadHintEn")}
                  </p>
                )}
                <Button
                  type="button"
                  size="lg"
                  variant="default"
                  className="h-11 gap-2 font-semibold shadow-md"
                  onClick={() => void loadCreators()}
                  disabled={loadingList}
                >
                  {loadingList ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  {t("creators.compareLoadCreators")}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Hook types</p>
          <div className="flex flex-wrap gap-2">
            {HOOK_TYPE_OPTIONS.map((o) => (
              <Button
                key={o.value}
                size="sm"
                variant={selectedTypes.includes(o.value) ? "default" : "outline"}
                onClick={() => toggleType(o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={() => void run()} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Compare
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex justify-end">
              <SaveInsightButton
                insightText={saveText}
                sourceType="hook_comparison"
                sourceReference="hook compare"
                tags={["hooks", "compare"]}
                label="Save Comparison"
              />
            </div>
            <p className="font-medium">{result.summary}</p>
            {result.creator_stats.map((c) => (
              <div key={c.creator_name} className="flex justify-between border-t pt-2">
                <span>{c.creator_name}</span>
                <span className="text-muted-foreground">
                  {c.hook_count} hooks · top {c.top_hook_type}
                </span>
              </div>
            ))}
            <p className="text-xs font-semibold uppercase text-muted-foreground">Triggers</p>
            <p>{result.top_triggers.join(", ")}</p>
            <ul className="list-inside list-disc">
              {result.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
