"use client";

import Link from "next/link";

import {
  CompareAudience,
  CompareBreakouts,
  CompareGrowthCharts,
  CompareHooks,
  CompareOverviewTable,
  CompareSemantic,
  CompareTitleBattle,
} from "@/components/compare/compare-sections";
import { CreatorAudienceSection } from "@/components/creators/creator-audience-section";
import { CreatorGrowthSection } from "@/components/creators/creator-growth-section";
import { CreatorHooksIntel } from "@/components/creators/creator-hooks-intel";
import { CreatorMomentumSection } from "@/components/creators/creator-momentum-section";
import { CreatorOverview } from "@/components/creators/creator-overview";
import { CreatorSemanticSection } from "@/components/creators/creator-semantic-section";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { slugifyCreatorName } from "@/lib/creator-slug";
import { updateResearchItem } from "@/services/api";
import type { CreatorCompareResult } from "@/types/creator-compare";
import type { CreatorIntelligence } from "@/types/creator-intelligence";
import type { ResearchItem } from "@/types/research";

interface ResearchItemDetailProps {
  item: ResearchItem;
  onUpdated: () => void;
}

export function ResearchItemDetail({ item, onUpdated }: ResearchItemDetailProps) {
  const t = useT();

  const saveNotes = async (notes: string) => {
    await updateResearchItem(item.id, { notes });
    onUpdated();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">{item.type}</p>
        <h2 className="text-xl font-semibold">{item.title}</h2>
        <p className="text-xs text-muted-foreground">
          {t("research.savedAt")} {new Date(item.created_at).toLocaleString()}
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">{t("research.itemNotes")}</label>
        <Input
          className="mt-1"
          defaultValue={item.notes}
          placeholder={t("research.itemNotesPlaceholder")}
          onBlur={(e) => {
            if (e.target.value !== item.notes) void saveNotes(e.target.value);
          }}
        />
      </div>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      <SnapshotBody item={item} />
    </div>
  );
}

function SnapshotBody({ item }: { item: ResearchItem }) {
  const t = useT();
  const p = item.payload_json;

  if (item.type === "creator_compare") {
    const data = p as unknown as CreatorCompareResult;
    if (!data.creator_a) {
      return <p className="text-sm text-muted-foreground">{t("research.invalidSnapshot")}</p>;
    }
    return (
      <div className="space-y-8">
        <CompareOverviewTable data={data} />
        <CompareGrowthCharts data={data} />
        <CompareHooks data={data} />
        <CompareAudience data={data} />
        <CompareSemantic data={data} />
        <CompareBreakouts data={data} />
        <CompareTitleBattle data={data} />
      </div>
    );
  }

  if (item.type === "creator_snapshot") {
    const intel = p as unknown as CreatorIntelligence;
    if (!intel.overview) {
      return <p className="text-sm text-muted-foreground">{t("research.invalidSnapshot")}</p>;
    }
    return (
      <div className="space-y-8">
        <CreatorOverview overview={intel.overview} growth={intel.growth} />
        <CreatorGrowthSection growth={intel.growth} />
        <CreatorMomentumSection momentum={intel.momentum} />
        <CreatorHooksIntel hooks={intel.hooks} />
        <CreatorAudienceSection audience={intel.audience} />
        <CreatorSemanticSection semantic={intel.semantic} />
        <Link
          href={`/creators/${slugifyCreatorName(intel.overview.creator_name)}`}
          className="text-sm text-primary underline"
        >
          {t("research.openLiveCreator")}
        </Link>
      </div>
    );
  }

  if (item.type === "breakout_video") {
    const title = String(p.title ?? "");
    const views = Number(p.views_count ?? 0);
    const vid = Number(p.video_id ?? 0);
    return (
      <div className="text-sm space-y-2">
        {vid > 0 && (
          <Link href={`/videos/${vid}`} className="text-primary underline">
            {title}
          </Link>
        )}
        <p>{views.toLocaleString()} views</p>
        {p.creator_name != null && <p>Creator: {String(p.creator_name)}</p>}
      </div>
    );
  }

  if (item.type === "hook") {
    return (
      <pre className="max-h-96 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
        {JSON.stringify(p, null, 2)}
      </pre>
    );
  }

  if (item.type === "audience_insight" || item.type === "semantic_theme" || item.type === "feed_signal") {
    return (
      <div className="space-y-2 text-sm">
        {p.summary != null && <p>{String(p.summary)}</p>}
        <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
          {JSON.stringify(p, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
      {JSON.stringify(p, null, 2)}
    </pre>
  );
}
