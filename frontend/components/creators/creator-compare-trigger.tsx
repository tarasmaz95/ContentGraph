"use client";

import Link from "next/link";
import { GitCompare } from "lucide-react";

import { QuickCompare } from "@/components/convenience/quick-compare";
import { useT } from "@/lib/i18n";

interface CreatorCompareTriggerProps {
  currentCreator: string;
}

/** Compare page link + 1-click quick compare */
export function CreatorCompareTrigger({ currentCreator }: CreatorCompareTriggerProps) {
  const t = useT();
  const href = `/compare?a=${encodeURIComponent(currentCreator)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted/50"
      >
        <GitCompare className="h-4 w-4" />
        {t("creators.compareWith")}
      </Link>
      <QuickCompare currentCreator={currentCreator} />
    </div>
  );
}
