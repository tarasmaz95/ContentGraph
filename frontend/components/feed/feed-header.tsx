"use client";

import { useT } from "@/lib/i18n";

interface FeedHeaderProps {
  catalogVideoCount: number;
  signalCount: number;
}

export function FeedHeader({
  catalogVideoCount,
  signalCount,
}: FeedHeaderProps) {
  const t = useT();

  return (
    <header className="space-y-1.5">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {t("feed.briefingTitle")}
      </h2>
      <p className="max-w-lg text-sm text-muted-foreground leading-relaxed">
        {t("feed.briefingSubtitlePlain")}
      </p>
      {catalogVideoCount > 0 && signalCount > 0 && (
        <p className="text-[11px] text-muted-foreground/65">
          {t("feed.headerMeta", {
            signals: signalCount,
            catalog: catalogVideoCount,
          })}
        </p>
      )}
    </header>
  );
}
