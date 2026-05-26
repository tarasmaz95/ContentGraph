"use client";

import { useLocale, useT } from "@/lib/i18n";

type HookToolGuideVariant = "generator" | "search";

/** Short how-to block for Hook Generator / Hook Search cards. */
export function HookToolGuide({ variant }: { variant: HookToolGuideVariant }) {
  const t = useT();
  const { locale } = useLocale();
  const prefix = variant === "generator" ? "hooks.generator" : "hooks.search";

  return (
    <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs space-y-2 leading-relaxed">
      <p className="font-medium text-foreground">{t(`${prefix}HowTitle`)}</p>
      <p className="text-muted-foreground">{t(`${prefix}HowBody`)}</p>
      {locale === "uk" && (
        <p className="text-muted-foreground/90 border-l-2 border-primary/30 pl-3">
          {t(`${prefix}HowEn`)}
        </p>
      )}
      <p className="text-muted-foreground border-t border-primary/10 pt-2">
        {t(`${prefix}Expect`)}
      </p>
    </div>
  );
}
