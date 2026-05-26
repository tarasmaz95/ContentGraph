"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";

import { HookCharts } from "@/components/hooks/hook-charts";
import { HookCompare } from "@/components/hooks/hook-compare";
import { HookGenerator } from "@/components/hooks/hook-generator";
import { HookPatternList } from "@/components/hooks/hook-pattern-list";
import { HookSearch } from "@/components/hooks/hook-search";
import { SaveInsightButton } from "@/components/research/save-insight-button";
import { formatHooksForSave } from "@/lib/research-format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PromptChips } from "@/components/ui/prompt-chips";
import { getPagePrompts, useLocale, useT } from "@/lib/i18n";
import { runExamplePrompt } from "@/lib/prompt-actions";
import { fetchHookWorkspace } from "@/services/api";
import type { HookWorkspace } from "@/types/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HooksPage() {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const pagePrompts = getPagePrompts(locale).hooks;
  const [data, setData] = useState<HookWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchHookWorkspace());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("hooks.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Zap} title={t("hooks.title")} helpKey="hook_intelligence" />
        <PageSkeleton rows={2} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Zap} title={t("hooks.title")} helpKey="hook_intelligence" />
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? t("common.noData")}
        </p>
      </div>
    );
  }

  if (data.total_hooks === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Zap} title={t("hooks.title")} helpKey="hook_intelligence" />
        <EmptyState
          icon={Zap}
          title={t("hooks.emptyTitle")}
          description={t("hooks.emptyDesc")}
          prompts={pagePrompts}
          onPrompt={(p) => runExamplePrompt(router, p)}
          links={[{ label: t("hooks.dashboardSync"), href: "/dashboard" }]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Zap}
        title={t("hooks.title")}
        description={t("hooks.description", { count: data.total_hooks })}
        helpKey="hook_intelligence"
      />

      <PromptChips prompts={pagePrompts} onSelect={(p) => runExamplePrompt(router, p)} />

      <section className="grid gap-6 lg:grid-cols-2">
        <HookGenerator />
        <HookSearch />
      </section>

      <HookCompare />

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("hooks.chartsSectionTitle")}</h2>
        <HookCharts charts={data.charts} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={t("hooks.topHooks")}
          description={t("hooks.topHooksDesc")}
          explain={t("hooks.topHooksExplain")}
          extra={
            <SaveInsightButton
              insightText={formatHooksForSave(t("hooks.topHooks"), data.top_hooks)}
              sourceType="hook_collection"
              sourceReference="top hooks"
              tags={["hooks", "top"]}
              label={t("common.saveSet")}
            />
          }
        >
          <HookPatternList
            patterns={data.top_hooks}
            metricsHint={t("hooks.patternMetricsHint")}
          />
        </Section>

        <Section
          title={t("hooks.bestPerforming")}
          description={t("hooks.bestPerformingDesc")}
          explain={t("hooks.bestPerformingExplain")}
          extra={
            <SaveInsightButton
              insightText={formatHooksForSave(
                t("hooks.bestPerforming"),
                data.best_performing,
              )}
              sourceType="hook_collection"
              sourceReference="best performing"
              tags={["hooks", "viral"]}
              label={t("hooks.saveViralSet")}
            />
          }
        >
          <HookPatternList
            patterns={data.best_performing}
            metricsHint={t("hooks.patternMetricsHint")}
          />
        </Section>

        <Section title={t("hooks.viralPatterns")} description={t("hooks.viralPatternsDesc")}>
          <ul className="space-y-2 text-sm">
            {data.viral_patterns.map((p) => (
              <li key={p.pattern} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                <span>{p.pattern}</span>
                <span className="text-muted-foreground tabular-nums">
                  {p.count} · {p.avg_views.toLocaleString()} {t("videos.avgShort")}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("hooks.categories")} description={t("hooks.categoriesDesc")}>
          <ul className="space-y-2 text-sm">
            {data.categories.map((c) => (
              <li key={c.hook_type} className="flex justify-between rounded-md border px-3 py-2">
                <span className="font-medium">{c.hook_type}</span>
                <span className="text-muted-foreground">
                  {t("common.hooksCount", { count: c.count })} ·{" "}
                  {c.avg_views.toLocaleString()} {t("videos.avgShort")}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={t("hooks.emotionalTriggers")}
          description={t("hooks.emotionalTriggersDesc")}
        >
          <ul className="flex flex-wrap gap-2">
            {data.emotional_triggers.map((tr) => (
              <span key={tr.pattern} className="rounded-full bg-muted px-3 py-1 text-sm">
                {tr.pattern} ({tr.avg_views.toLocaleString()})
              </span>
            ))}
          </ul>
        </Section>

        <Section title={t("hooks.trends")} description={t("hooks.trendsDesc")}>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {data.trends.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  explain,
  children,
  extra,
}: {
  title: string;
  description: string;
  explain?: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Card className="border-primary/10">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0 space-y-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {explain && (
            <p className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {explain}
            </p>
          )}
        </div>
        {extra}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
