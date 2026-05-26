"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";

import { SaveInsightButton } from "@/components/research/save-insight-button";
import { formatComparisonForSave } from "@/lib/research-format";
import { useLocale, useT } from "@/lib/i18n";
import { compareCreators, fetchCreators } from "@/services/api";
import type { CreatorComparisonResult } from "@/types/creator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ComparePanelProps {
  preselected?: string[];
  /** Names from parent page — avoids extra "load" click when grid already fetched */
  availableCreators?: string[];
  /** Parent still fetching creators — show spinner instead of manual load */
  creatorsLoading?: boolean;
}

/** Compare 2+ creators — hooks, style, topics, positioning */
export function ComparePanel({
  preselected = [],
  availableCreators = [],
  creatorsLoading = false,
}: ComparePanelProps) {
  const t = useT();
  const { locale } = useLocale();
  const [selected, setSelected] = useState<string[]>(preselected);
  const [loadedCreators, setLoadedCreators] = useState<string[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [result, setResult] = useState<CreatorComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creatorNames = useMemo(() => {
    if (availableCreators.length > 0) return availableCreators;
    if (loadedCreators.length > 0) return loadedCreators;
    return preselected;
  }, [availableCreators, loadedCreators, preselected]);

  useEffect(() => {
    if (preselected.length > 0) {
      setSelected(preselected);
    }
  }, [preselected]);

  const loadCreators = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await fetchCreators();
      setLoadedCreators(list.map((c) => c.creator_name));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("creators.compareFailed"));
    } finally {
      setLoadingList(false);
    }
  };

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name].slice(0, 4),
    );
  };

  const runCompare = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      if (creatorNames.length === 0) await loadCreators();
      const comparison = await compareCreators(selected);
      setResult(comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("creators.compareFailed"));
    } finally {
      setLoading(false);
    }
  };

  const showLoadButton = creatorNames.length === 0 && !creatorsLoading;

  return (
    <Card className="border-primary/20">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">{t("creators.compareTitle")}</CardTitle>
        <CardDescription>{t("creators.compareDesc")}</CardDescription>
        <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground space-y-1 leading-relaxed">
          <p className="font-medium text-foreground">{t("creators.compareHowTitle")}</p>
          <p>{t("creators.compareHowBody")}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {creatorsLoading && creatorNames.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            {t("creators.compareLoadingList")}
          </div>
        ) : null}

        {showLoadButton ? (
          <div className="rounded-xl border-2 border-primary/35 bg-primary/10 p-5 space-y-4 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t("creators.compareLoadTitle")}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("creators.compareLoadHint")}
              </p>
              {locale === "uk" && (
                <p className="text-xs leading-relaxed text-muted-foreground/90 border-l-2 border-primary/30 pl-3">
                  {t("creators.compareLoadHintEn")}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="lg"
              variant="default"
              className="h-12 w-full gap-2 text-base font-semibold shadow-md sm:w-auto sm:min-w-[280px]"
              onClick={() => void loadCreators()}
              disabled={loadingList}
            >
              {loadingList ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Users className="h-5 w-5" />
              )}
              {t("creators.compareLoadCreators")}
            </Button>
          </div>
        ) : creatorNames.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("creators.compareLoaded", { count: creatorNames.length })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {creatorNames.map((name) => (
            <Button
              key={name}
              variant={selected.includes(name) ? "default" : "outline"}
              size="sm"
              onClick={() => toggle(name)}
            >
              {name}
            </Button>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full sm:w-auto gap-2"
          onClick={() => void runCompare()}
          disabled={loading || selected.length < 2}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {selected.length < 2
            ? t("creators.compareSelectMin", { n: 2 - selected.length })
            : t("creators.compareRun", { count: selected.length })}
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex justify-end">
              <SaveInsightButton
                insightText={formatComparisonForSave(result)}
                sourceType="creator_comparison"
                sourceReference={result.creators.join(" vs ")}
                tags={result.creators}
                label={t("creators.compareSave")}
              />
            </div>
            <p className="font-medium">{result.summary}</p>
            <Section title={t("creators.compareSectionStyle")} text={result.style_comparison} />
            <Section title={t("creators.compareSectionHooks")} items={result.hook_comparison} />
            <Section title={t("creators.compareSectionTopics")} items={result.topic_comparison} />
            <Section
              title={t("creators.compareSectionPositioning")}
              items={result.positioning_comparison}
            />
            <Section
              title={t("creators.compareSectionCommunication")}
              items={result.communication_comparison}
            />
            <Section
              title={t("creators.compareSectionRecommendations")}
              items={result.recommendations}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  text,
  items,
}: {
  title: string;
  text?: string;
  items?: string[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      {text && <p className="mt-1">{text}</p>}
      {items && (
        <ul className="mt-1 list-inside list-disc">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
