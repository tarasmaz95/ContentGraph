"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CompareSection } from "@/components/compare/compare-section";
import type { CreatorCompareResult } from "@/types/creator-compare";
import type { CreatorIntelligence } from "@/types/creator-intelligence";
import type { ChartPoint } from "@/types/creator-page";
import {
  formatTitleMeta,
  formatTopicOverlapMessage,
  humanizeHookList,
  isGrowthLikelyFlat,
} from "@/lib/compare-display-copy";
import { useT } from "@/lib/i18n";

const SIGNAL_LABEL_KEYS: Record<string, string> = {
  subscribers: "compare.signal_subscribers",
  avg_views: "compare.signal_avg_views",
  total_views: "compare.signal_total_views",
  videos: "compare.signal_videos",
  growth_7d_pct: "compare.signal_growth_7d",
  velocity: "compare.signal_recent_pace",
  breakout_rate: "compare.signal_breakout_rate",
};

const HOOK_KEYS = [
  ["curiosity_pct", "compare.hookCuriosity"],
  ["authority_pct", "compare.hookAuthority"],
  ["identity_pct", "compare.hookIdentity"],
  ["numbers_pct", "compare.hookNumbers"],
  ["how_to_pct", "compare.hookHowTo"],
] as const;

function mergeDualSeries(
  a: ChartPoint[],
  b: ChartPoint[],
): { label: string; a: number | null; b: number | null }[] {
  const labels = new Set([...a.map((p) => p.label), ...b.map((p) => p.label)]);
  return [...labels].sort().map((label) => ({
    label,
    a: a.find((p) => p.label === label)?.value ?? null,
    b: b.find((p) => p.label === label)?.value ?? null,
  }));
}

export function CompareOverviewTable({ data }: { data: CreatorCompareResult }) {
  const t = useT();
  return (
    <CompareSection
      title={t("compare.sectionOverview")}
      description={t("compare.sectionOverviewDesc")}
      primary
    >
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t("compare.signal")}</th>
              <th className="py-2 pr-4">{data.creator_a}</th>
              <th className="py-2">{data.creator_b}</th>
            </tr>
          </thead>
          <tbody>
            {data.overview_rows.map((row) => (
              <tr key={row.signal} className="border-b border-border/40">
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {t(
                    (SIGNAL_LABEL_KEYS[row.signal] ??
                      "compare.signal") as "compare.signal_subscribers",
                  )}
                </td>
                <td
                  className={`py-2.5 pr-4 tabular-nums ${row.winner === "a" ? "font-semibold text-foreground" : ""}`}
                >
                  {row.value_a}
                </td>
                <td
                  className={`py-2.5 tabular-nums ${row.winner === "b" ? "font-semibold text-foreground" : ""}`}
                >
                  {row.value_b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data.growth_winner || data.momentum_winner || data.hooks_winner) && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {data.growth_winner && (
            <span>{t("compare.winnerGrowth")}: {data.growth_winner}</span>
          )}
          {data.hooks_winner && (
            <span>{t("compare.winnerHooks")}: {data.hooks_winner}</span>
          )}
        </div>
      )}
    </CompareSection>
  );
}

export function CompareGrowthCharts({ data }: { data: CreatorCompareResult }) {
  const t = useT();
  const gc = data.growth_compare;
  const subs = mergeDualSeries(gc.subscriber_a, gc.subscriber_b);
  const views = mergeDualSeries(gc.views_a, gc.views_b);
  const hasData = subs.length > 0 || views.length > 0;
  const flat = isGrowthLikelyFlat(data.overview_rows);

  if (!hasData) {
    return (
      <CompareSection
        title={t("compare.sectionGrowth")}
        description={t("compare.growthEmptyHuman")}
      >
        <p className="text-sm text-muted-foreground">{t("compare.growthNoData")}</p>
      </CompareSection>
    );
  }

  return (
    <CompareSection title={t("compare.sectionGrowth")} description={t("compare.sectionGrowthDesc")}>
      {flat ? (
        <p className="mb-6 text-sm text-muted-foreground">{t("compare.growthFlat")}</p>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-2">
        <DualChart
          title={t("compare.subscriberGrowth")}
          data={subs}
          nameA={data.creator_a}
          nameB={data.creator_b}
        />
        <DualChart
          title={t("compare.viewsGrowth")}
          data={views}
          nameA={data.creator_a}
          nameB={data.creator_b}
        />
      </div>
    </CompareSection>
  );
}

function DualChart({
  title,
  data,
  nameA,
  nameB,
}: {
  title: string;
  data: { label: string; a: number | null; b: number | null }[];
  nameA: string;
  nameB: string;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">{title}</p>
      <div className="h-52 rounded-lg bg-muted/20 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="a"
              name={nameA}
              stroke="hsl(var(--primary))"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="b"
              name={nameB}
              stroke="hsl(var(--muted-foreground))"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CompareHooks({ data }: { data: CreatorCompareResult }) {
  const t = useT();
  return (
    <CompareSection title={t("compare.sectionHooks")} description={t("compare.sectionHooksDesc")}>
      <div className="grid gap-10 lg:grid-cols-2">
        <HookMixBlock name={data.creator_a} intel={data.intelligence_a} />
        <HookMixBlock name={data.creator_b} intel={data.intelligence_b} />
      </div>
    </CompareSection>
  );
}

function HookMixBlock({ name, intel }: { name: string; intel: CreatorIntelligence }) {
  const t = useT();
  const mix = intel.hooks.mix;
  return (
    <div>
      <p className="mb-3 text-sm font-medium">{name}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {HOOK_KEYS.map(([key, labelKey]) => (
          <div key={key}>
            <span className="text-muted-foreground">{t(labelKey)}</span>
            <p className="font-medium tabular-nums">{mix[key].toFixed(0)}%</p>
          </div>
        ))}
      </div>
      {intel.hooks.best_performing_hooks.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t("compare.bestTitleFormats")}: </span>
          {humanizeHookList(intel.hooks.best_performing_hooks.join(", "), t)}
        </p>
      )}
    </div>
  );
}

export function CompareAudience({ data }: { data: CreatorCompareResult }) {
  const t = useT();
  return (
    <CompareSection
      title={t("compare.sectionAudience")}
      description={t("compare.sectionAudienceDesc")}
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <AudienceBlock name={data.creator_a} intel={data.intelligence_a} />
        <AudienceBlock name={data.creator_b} intel={data.intelligence_b} />
      </div>
    </CompareSection>
  );
}

function AudienceBlock({ name, intel }: { name: string; intel: CreatorIntelligence }) {
  const t = useT();
  const aud = intel.audience;
  if (aud.total_comments === 0) {
    return (
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("compare.audienceEmpty")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">
        {name}{" "}
        <span className="font-normal text-muted-foreground">
          ({aud.total_comments} {t("compare.comments")})
        </span>
      </p>
      {aud.emotional_patterns.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">{t("creators.emotionalPatterns")}</p>
          <p>{aud.emotional_patterns.join(" · ")}</p>
        </div>
      )}
      {aud.repeated_phrases.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">{t("creators.repeatedPhrases")}</p>
          <p className="text-muted-foreground">{aud.repeated_phrases.slice(0, 5).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

export function CompareSemantic({ data }: { data: CreatorCompareResult }) {
  const t = useT();
  const s = data.semantic_overlap;
  return (
    <CompareSection
      title={t("compare.sectionSemantic")}
      description={formatTopicOverlapMessage(s.overlap_score, t)}
    >
      <div className="grid gap-6 md:grid-cols-3">
        <ThemeList title={t("compare.sharedThemes")} items={s.shared_themes} />
        <ThemeList title={t("compare.uniqueThemesA", { name: data.creator_a })} items={s.unique_a} />
        <ThemeList title={t("compare.uniqueThemesB", { name: data.creator_b })} items={s.unique_b} />
      </div>
    </CompareSection>
  );
}

function ThemeList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-muted/60 px-2.5 py-0.5 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CompareBreakouts({ data }: { data: CreatorCompareResult }) {
  const t = useT();
  return (
    <CompareSection
      title={t("compare.sectionBreakouts")}
      description={t("compare.sectionBreakoutsDesc")}
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <BreakoutBlock name={data.creator_a} intel={data.intelligence_a} />
        <BreakoutBlock name={data.creator_b} intel={data.intelligence_b} />
      </div>
    </CompareSection>
  );
}

function BreakoutBlock({ name, intel }: { name: string; intel: CreatorIntelligence }) {
  const t = useT();
  const items = intel.momentum.breakout_videos.slice(0, 5);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{name}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("compare.noBreakouts")}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((v) => (
            <li key={v.video_id}>
              <Link href={`/videos/${v.video_id}`} className="text-primary hover:underline">
                {v.title}
              </Link>
              <span className="ml-2 text-muted-foreground tabular-nums">
                +{v.views_delta_7d.toLocaleString()} {t("compare.viewsGained")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CompareTitleBattle({ data }: { data: CreatorCompareResult }) {
  const t = useT();
  return (
    <CompareSection
      title={t("compare.sectionTitleBattle")}
      description={t("compare.sectionTitleBattleDesc")}
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <TitleBattleColumn name={data.creator_a} items={data.title_battle_a} />
        <TitleBattleColumn name={data.creator_b} items={data.title_battle_b} />
      </div>
    </CompareSection>
  );
}

function TitleBattleColumn({
  name,
  items,
}: {
  name: string;
  items: CreatorCompareResult["title_battle_a"];
}) {
  const t = useT();
  return (
    <div>
      <p className="mb-4 text-sm font-medium">{name}</p>
      <ul className="divide-y divide-border/40">
        {items.map((item, i) => (
          <li key={item.video_id} className="py-4 first:pt-0">
            <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>#{i + 1}</span>
              <span className="tabular-nums">
                {item.views_count.toLocaleString()} {t("compare.viewsLabel")}
              </span>
            </div>
            <Link
              href={`/videos/${item.video_id}`}
              className="mt-1 block text-sm font-medium leading-snug text-foreground hover:text-primary"
            >
              {item.title}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatTitleMeta(item.hook_type, item.title_length, t)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
