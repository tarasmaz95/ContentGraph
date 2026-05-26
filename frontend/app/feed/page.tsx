"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Newspaper } from "lucide-react";

import { FeedHeader } from "@/components/feed/feed-header";
import { FeedHero } from "@/components/feed/feed-hero";
import { FeedResearchPath } from "@/components/feed/feed-research-path";
import { FeedResearchSection } from "@/components/feed/feed-research-section";
import { FeedHowToUse } from "@/components/feed/feed-how-to-use";
import { FeedOperationalNotices } from "@/components/feed/feed-operational-notices";
import { useCopilotContext } from "@/components/copilot/copilot-context";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PromptChips } from "@/components/ui/prompt-chips";
import { getPagePrompts, useLocale, useT } from "@/lib/i18n";
import {
  buildDailyBriefing,
  hasBriefingContent,
} from "@/lib/feed-briefing";
import { runExamplePrompt } from "@/lib/prompt-actions";
import { fetchIntelligenceFeed } from "@/services/api";
import type { FeedBriefingMeta, FeedItem } from "@/types/copilot";

export default function FeedPage() {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const { setCollapsed } = useCopilotContext();
  const pagePrompts = getPagePrompts(locale).feed;
  const [rawItems, setRawItems] = useState<FeedItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [briefingMeta, setBriefingMeta] = useState<FeedBriefingMeta | null>(
    null,
  );

  const layout = useMemo(
    () => buildDailyBriefing(rawItems, briefingMeta, t),
    [rawItems, briefingMeta, t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const feed = await fetchIntelligenceFeed(8);
      setRawItems(feed.items);
      setCatalogTotal(feed.catalog_video_count);
      setBriefingMeta(feed.briefing);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  const hasContent = hasBriefingContent(layout);

  return (
    <div className="mx-auto max-w-3xl px-1 sm:max-w-[42rem]">
      <PageHeader
        icon={Newspaper}
        title={t("feed.title")}
        description={t("feed.description")}
        helpKey="intelligence_feed"
        className="mb-2"
      />

      {!loading && hasContent && (
        <div className="mb-10 space-y-4">
          <FeedHowToUse />
          <FeedHeader
            catalogVideoCount={catalogTotal}
            signalCount={layout.totalSignals}
          />
          <FeedOperationalNotices briefing={briefingMeta} layout={layout} />
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/60" />
        </div>
      )}

      {!loading && !hasContent && (
        <EmptyState
          icon={Newspaper}
          title={t("feed.emptyTitle")}
          description={t("feed.emptyDesc")}
          prompts={pagePrompts}
          onPrompt={(p) => runExamplePrompt(router, p)}
          links={[{ label: t("feed.syncDashboard"), href: "/dashboard" }]}
        />
      )}

      {!loading && hasContent && (
        <>
          <div className="space-y-14 pb-4">
            {layout.hero ? <FeedHero insight={layout.hero} /> : null}
            {layout.researchPath.length > 0 ? (
              <FeedResearchPath steps={layout.researchPath} />
            ) : null}
          </div>

          <div className="mt-6 border-t border-border/50 pt-14">
            {layout.sections.map((section, index) => (
              <FeedResearchSection
                key={section.id}
                section={section}
                isFirst={index === 0}
              />
            ))}
          </div>
        </>
      )}

      {!loading && hasContent && (
        <div className="mt-16 border-t border-border/40 pt-10">
          <PromptChips
            prompts={pagePrompts}
            onSelect={(p) => runExamplePrompt(router, p)}
          />
        </div>
      )}
    </div>
  );
}
