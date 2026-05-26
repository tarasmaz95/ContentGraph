"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import {
  fetchCreatorGrowth,
  fetchVelocitySpikes,
  fetchVideoBreakouts,
} from "@/services/api";

/**
 * Lightweight Growth Trends block — uses historical snapshot APIs.
 */
export function GrowthTrends() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<string[]>([]);
  const [breakouts, setBreakouts] = useState<string[]>([]);
  const [velocity, setVelocity] = useState<string[]>([]);
  const [latest, setLatest] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cg, vb, vel] = await Promise.all([
        fetchCreatorGrowth(8),
        fetchVideoBreakouts(8),
        fetchVelocitySpikes(8),
      ]);
      setLatest(cg.snapshot_date_latest);
      setEmpty(
        cg.items.length === 0 && vb.items.length === 0 && vel.items.length === 0,
      );
      setCreators(
        cg.items.map(
          (c) =>
            `${c.creator_name}: +${c.subscribers_delta_7d.toLocaleString()} subs (7d), ${c.growth_7d_pct.toFixed(1)}%`,
        ),
      );
      setBreakouts(
        vb.items.map(
          (v) =>
            `${v.title.slice(0, 50) || `Video ${v.video_id}`}: +${v.views_delta_7d.toLocaleString()} views (7d)`,
        ),
      );
      setVelocity(
        vel.items.map(
          (v) =>
            `${v.title.slice(0, 50) || `Video ${v.video_id}`}: ${v.velocity_views_per_day.toLocaleString()} views/day`,
        ),
      );
    } catch {
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("analytics.growthTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("analytics.growthDesc")}
          {latest ? ` · ${t("analytics.growthLatest", { date: latest })}` : ""}
        </p>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">{t("analytics.growthEmpty")}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <TrendCard title={t("analytics.growthCreators")} items={creators} />
          <TrendCard title={t("analytics.growthBreakouts")} items={breakouts} />
          <TrendCard title={t("analytics.growthVelocity")} items={velocity} />
        </div>
      )}
    </section>
  );
}

function TrendCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{items.length} results</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {items.length === 0 ? (
            <li className="text-muted-foreground">—</li>
          ) : (
            items.map((item) => (
              <li key={item} className="rounded bg-muted/40 px-2 py-1">
                {item}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
