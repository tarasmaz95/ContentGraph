"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitCompare, Users } from "lucide-react";

import { ComparePanel } from "@/components/creators/compare-panel";
import { CreatorCard } from "@/components/creators/creator-card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PromptChips } from "@/components/ui/prompt-chips";
import { getPagePrompts, useLocale, useT } from "@/lib/i18n";
import { runExamplePrompt } from "@/lib/prompt-actions";
import { fetchCreators } from "@/services/api";
import type { CreatorListItem } from "@/types/creator";

export default function CreatorsPage() {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const pagePrompts = getPagePrompts(locale).creators;
  const [creators, setCreators] = useState<CreatorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCreators(await fetchCreators());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("creators.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Users}
        title={t("creators.title")}
        description={t("creators.description")}
        helpKey="creator_profile"
      />

      <PromptChips prompts={pagePrompts} onSelect={(p) => runExamplePrompt(router, p)} />

      <Link
        href="/compare"
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
      >
        <GitCompare className="h-4 w-4 text-primary" />
        {t("compare.title")}
      </Link>

      <ComparePanel
        availableCreators={creators.map((c) => c.creator_name)}
        creatorsLoading={loading}
      />

      {loading && <PageSkeleton rows={3} />}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && creators.length === 0 && (
        <EmptyState
          icon={Users}
          title={t("creators.emptyTitle")}
          description={t("creators.emptyDesc")}
          prompts={pagePrompts}
          onPrompt={(p) => runExamplePrompt(router, p)}
          links={[
            { label: t("creators.syncDashboard"), href: "/dashboard" },
            { label: t("creators.askCopilot"), href: "/chat" },
          ]}
        />
      )}

      {!loading && creators.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator) => (
            <CreatorCard key={creator.creator_name} creator={creator} />
          ))}
        </div>
      )}
    </div>
  );
}
