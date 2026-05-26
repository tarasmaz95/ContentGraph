"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GitCompare, Loader2 } from "lucide-react";

import {
  CompareAudience,
  CompareBreakouts,
  CompareGrowthCharts,
  CompareHooks,
  CompareOverviewTable,
  CompareSemantic,
  CompareTitleBattle,
} from "@/components/compare/compare-sections";
import { CompareToolbar } from "@/components/compare/compare-toolbar";
import { CreatorPicker } from "@/components/compare/creator-picker";
import { useCopilotContext } from "@/components/copilot/copilot-context";
import { SavedSearchesChips } from "@/components/convenience/saved-searches-chips";
import { useT } from "@/lib/i18n";
import { fetchCreatorCompare, fetchCreators } from "@/services/api";
import type { CreatorCompareResult } from "@/types/creator-compare";
import { Button } from "@/components/ui/button";

function mergeCompareExtended(
  base: CreatorCompareResult,
  ext: CreatorCompareResult,
): CreatorCompareResult {
  return {
    ...base,
    intelligence_a: {
      ...base.intelligence_a,
      audience: ext.intelligence_a.audience,
      momentum: ext.intelligence_a.momentum,
    },
    intelligence_b: {
      ...base.intelligence_b,
      audience: ext.intelligence_b.audience,
      momentum: ext.intelligence_b.momentum,
    },
    momentum_winner: ext.momentum_winner ?? base.momentum_winner,
  };
}

export function ComparePageClient() {
  const t = useT();
  const { setCollapsed } = useCopilotContext();
  const searchParams = useSearchParams();
  const [creators, setCreators] = useState<string[]>([]);
  const [creatorA, setCreatorA] = useState("");
  const [creatorB, setCreatorB] = useState("");
  const [result, setResult] = useState<CreatorCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchCreators();
        const names = [
          ...new Set(list.map((c) => c.creator_name).filter(Boolean)),
        ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        setCreators(names);
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    if (a) setCreatorA(a);
    if (b) setCreatorB(b);
  }, [searchParams]);

  const loadCompare = useCallback(
    async (a: string, b: string) => {
      setLoading(true);
      setExtendedLoading(false);
      setError(null);
      try {
        const core = await fetchCreatorCompare(a, b, "core");
        setResult(core);
        setLoading(false);
        const url = new URL(window.location.href);
        url.searchParams.set("a", core.creator_a);
        url.searchParams.set("b", core.creator_b);
        window.history.replaceState({}, "", url.pathname + url.search);

        setExtendedLoading(true);
        const ext = await fetchCreatorCompare(a, b, "extended");
        setResult((prev) => (prev ? mergeCompareExtended(prev, ext) : ext));
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : t("compare.failed"));
      } finally {
        setLoading(false);
        setExtendedLoading(false);
      }
    },
    [t],
  );

  const runCompare = useCallback(() => {
    if (!creatorA || !creatorB || creatorA === creatorB) return;
    void loadCompare(creatorA, creatorB);
  }, [creatorA, creatorB, loadCompare]);

  useEffect(() => {
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    if (!listLoading && a && b && a !== b) {
      setCreatorA(a);
      setCreatorB(b);
      void loadCompare(a, b);
    }
  }, [listLoading, searchParams, loadCompare]);

  const canCompare = useMemo(
    () => Boolean(creatorA && creatorB && creatorA !== creatorB),
    [creatorA, creatorB],
  );

  const helperText = useMemo(() => {
    if (!creatorA || !creatorB) return t("compare.selectTwo");
    if (creatorA === creatorB) return t("compare.pickDifferent");
    return null;
  }, [creatorA, creatorB, t]);

  return (
    <div className="mx-auto max-w-3xl sm:max-w-[44rem]">
      <header className="mb-8">
        <Link
          href="/creators"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← {t("creators.allCreators")}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <GitCompare className="h-7 w-7 text-primary shrink-0" />
          {t("compare.title")}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground leading-relaxed">
          {t("compare.subtitle")}
        </p>
        {!result && !loading && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("compare.onboarding1")}</li>
            <li>{t("compare.onboarding2")}</li>
            <li>{t("compare.onboarding3")}</li>
          </ul>
        )}
      </header>

      <section className="relative z-40 mb-10 space-y-3">
        {listLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <CreatorPicker
              label={t("compare.creatorA")}
              creators={creators}
              value={creatorA}
              onChange={setCreatorA}
              exclude={creatorB}
            />
            <CreatorPicker
              label={t("compare.creatorB")}
              creators={creators}
              value={creatorB}
              onChange={setCreatorB}
              exclude={creatorA}
            />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button
            className="sm:min-w-[140px]"
            disabled={!canCompare || loading}
            onClick={() => void runCompare()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("compare.run")
            )}
          </Button>
          {helperText ? (
            <p className="text-sm text-muted-foreground">{helperText}</p>
          ) : null}
        </div>
      </section>

      {error && (
        <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && !result && (
        <div className="space-y-8 animate-pulse py-4">
          <div className="h-32 rounded-lg bg-muted/30" />
          <div className="h-48 rounded-lg bg-muted/20" />
        </div>
      )}

      {result && (
        <div className="space-y-2 pb-12">
          <CompareToolbar result={result} />

          <SavedSearchesChips
            showSaveSemantic={false}
            onRunCompare={(a, b) => {
              setCreatorA(a);
              setCreatorB(b);
              void loadCompare(a, b);
            }}
          />

          {extendedLoading ? (
            <p className="text-xs text-muted-foreground">{t("compare.loadingMore")}</p>
          ) : null}

          <CompareOverviewTable data={result} />
          <CompareGrowthCharts data={result} />
          <CompareHooks data={result} />
          <CompareAudience data={result} />
          <CompareSemantic data={result} />
          <CompareBreakouts data={result} />
          <CompareTitleBattle data={result} />
        </div>
      )}
    </div>
  );
}
