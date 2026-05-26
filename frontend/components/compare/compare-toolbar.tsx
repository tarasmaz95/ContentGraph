"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { CopyButton } from "@/components/convenience/copy-button";
import { QuickCompare } from "@/components/convenience/quick-compare";
import { SaveResearchButton } from "@/components/research/save-research-button";
import { formatCompareSummaryMarkdown } from "@/lib/copy-summaries";
import { slugifyCreatorName } from "@/lib/creator-slug";
import { useT } from "@/lib/i18n";
import type { CreatorCompareResult } from "@/types/creator-compare";
interface CompareToolbarProps {
  result: CreatorCompareResult;
}

export function CompareToolbar({ result }: CompareToolbarProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-4 border-b border-border/50 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {result.creator_a}{" "}
        <span className="font-normal text-muted-foreground">{t("compare.vs")}</span>{" "}
        {result.creator_b}
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <SaveResearchButton
          type="creator_compare"
          title={`${result.creator_a} vs ${result.creator_b}`}
          payload={result as unknown as Record<string, unknown>}
          tags={[result.creator_a, result.creator_b, "compare"]}
          label={t("research.saveToResearch")}
        />
        <CopyButton
          text={formatCompareSummaryMarkdown(result)}
          label={t("convenience.copyCompare")}
        />
        <Link
          href={`/creators/${slugifyCreatorName(result.creator_a)}`}
          className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted/50"
        >
          {t("compare.studyCreator", { name: result.creator_a })}
        </Link>
        <Link
          href={`/creators/${slugifyCreatorName(result.creator_b)}`}
          className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted/50"
        >
          {t("compare.studyCreator", { name: result.creator_b })}
        </Link>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            <MoreHorizontal className="h-4 w-4" />
            {t("compare.moreActions")}
          </summary>
          <div className="absolute right-0 z-20 mt-1 min-w-[200px] rounded-md border bg-popover p-2 shadow-md">
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <QuickCompare currentCreator={result.creator_a} />
              <QuickCompare currentCreator={result.creator_b} />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
