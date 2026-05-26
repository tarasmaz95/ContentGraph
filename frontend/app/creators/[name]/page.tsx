"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import { CreatorAnalyticsSections } from "@/components/creators/creator-analytics-sections";
import { CreatorAudienceSection } from "@/components/creators/creator-audience-section";
import { CopyButton } from "@/components/convenience/copy-button";
import { PinCreatorButton } from "@/components/convenience/pin-creator-button";
import { CreatorCompareTrigger } from "@/components/creators/creator-compare-trigger";
import { CreatorGrowthSection } from "@/components/creators/creator-growth-section";
import { CreatorHooksIntel } from "@/components/creators/creator-hooks-intel";
import { CreatorMomentumSection } from "@/components/creators/creator-momentum-section";
import { CreatorOverview } from "@/components/creators/creator-overview";
import { CreatorProfileView } from "@/components/creators/creator-profile-view";
import { CreatorSemanticSearch } from "@/components/creators/creator-semantic-search";
import { CreatorSemanticSection } from "@/components/creators/creator-semantic-section";
import { SaveInsightButton } from "@/components/research/save-insight-button";
import { SaveResearchButton } from "@/components/research/save-research-button";
import {
  formatCreatorProfileForSave,
  formatHookAnalysisForSave,
} from "@/lib/research-format";
import { trackCreatorView } from "@/lib/personalization";
import { useT } from "@/lib/i18n";
import {
  formatAudienceMarkdown,
  formatBreakoutsMarkdown,
  formatCreatorIntelMarkdown,
  formatHooksMarkdown,
} from "@/lib/copy-summaries";
import { fetchCreator, fetchCreatorIntelligence } from "@/services/api";
import type { CreatorProfile } from "@/types/creator";
import type { CreatorIntelligence } from "@/types/creator-intelligence";
import { Button } from "@/components/ui/button";

/**
 * Creator intelligence dashboard — /creators/[name]
 */
export default function CreatorDetailPage() {
  const t = useT();
  const params = useParams();
  const slug = decodeURIComponent((params.name as string) ?? "");

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [intel, setIntel] = useState<CreatorIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refreshProfile = false) => {
      if (!slug) return;
      if (refreshProfile) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [intelData, profileData] = await Promise.all([
          fetchCreatorIntelligence(slug),
          fetchCreator(slug, refreshProfile),
        ]);
        setIntel(intelData);
        setProfile(profileData);
        trackCreatorView(intelData.overview.creator_name);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("creators.loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [slug, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = intel?.overview.creator_name ?? profile?.creator_name ?? slug;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/creators" className="text-sm text-primary underline">
            ← {t("creators.allCreators")}
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("creators.pageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {intel && (
            <SaveResearchButton
              type="creator_snapshot"
              title={`${displayName} intelligence`}
              payload={intel as unknown as Record<string, unknown>}
              tags={[displayName, "creator"]}
              label={t("research.saveCreator")}
            />
          )}
          <PinCreatorButton creatorName={displayName} />
          <CreatorCompareTrigger currentCreator={displayName} />
          {intel && (
            <CopyButton
              text={formatCreatorIntelMarkdown(intel)}
              label={t("convenience.copyIntel")}
            />
          )}
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("creators.regenerateProfile")}
          </Button>
        </div>
      </header>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {intel && (
        <>
          <section>
            <h2 className="mb-4 text-lg font-semibold">{t("creators.sectionOverview")}</h2>
            <CreatorOverview overview={intel.overview} growth={intel.growth} />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">{t("creators.sectionGrowth")}</h2>
            <CreatorGrowthSection growth={intel.growth} />
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("creators.sectionMomentum")}</h2>
              <CopyButton
                text={formatBreakoutsMarkdown(intel)}
                label={t("convenience.copyBreakouts")}
              />
              {intel.momentum.breakout_videos[0] && (
                <SaveResearchButton
                  type="breakout_video"
                  title={intel.momentum.breakout_videos[0].title}
                  payload={{
                    ...intel.momentum.breakout_videos[0],
                    creator_name: displayName,
                  }}
                  tags={[displayName, "breakout"]}
                  label={t("research.saveBreakout")}
                />
              )}
            </div>
            <CreatorMomentumSection momentum={intel.momentum} />
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("creators.sectionHooks")}</h2>
              <CopyButton text={formatHooksMarkdown(intel)} label={t("convenience.copyHooks")} />
              <SaveResearchButton
                type="hook"
                title={`${displayName} hook mix`}
                payload={{ creator: displayName, hooks: intel.hooks }}
                tags={[displayName, "hooks"]}
                label={t("research.saveHook")}
              />
            </div>
            <CreatorHooksIntel hooks={intel.hooks} />
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("creators.sectionAudience")}</h2>
              <CopyButton
                text={formatAudienceMarkdown(intel)}
                label={t("convenience.copyAudience")}
              />
              <SaveResearchButton
                type="audience_insight"
                title={`${displayName} audience`}
                payload={{ creator: displayName, audience: intel.audience }}
                tags={[displayName, "audience"]}
                label={t("research.saveAudience")}
              />
            </div>
            <CreatorAudienceSection audience={intel.audience} />
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("creators.sectionSemantic")}</h2>
              <SaveResearchButton
                type="semantic_theme"
                title={`${displayName} themes`}
                payload={{ creator: displayName, semantic: intel.semantic }}
                tags={[displayName, "semantic"]}
                label={t("research.saveTheme")}
              />
            </div>
            <CreatorSemanticSection semantic={intel.semantic} />
          </section>

          {profile && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t("creators.aiProfile")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <SaveInsightButton
                    insightText={formatCreatorProfileForSave(profile)}
                    sourceType="creator_profile"
                    sourceReference={profile.creator_name}
                    tags={[profile.creator_name, "creator"]}
                    label={t("creators.saveProfile")}
                  />
                  <SaveInsightButton
                    insightText={formatHookAnalysisForSave(
                      profile.creator_name,
                      intel.sections.hook_analysis,
                    )}
                    sourceType="creator_hooks"
                    sourceReference={profile.creator_name}
                    tags={[profile.creator_name, "hooks"]}
                    label={t("creators.saveHooks")}
                  />
                </div>
              </div>
              <CreatorProfileView profile={profile} />
            </section>
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold">{t("creators.sectionCatalog")}</h2>
            <CreatorAnalyticsSections sections={intel.sections} />
          </section>

          <section>
            <CreatorSemanticSearch creatorSlug={slug} />
          </section>
        </>
      )}
    </div>
  );
}
