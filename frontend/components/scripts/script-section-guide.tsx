"use client";

import { useLocale, useT } from "@/lib/i18n";

type ScriptGuideKey =
  | "generator"
  | "style"
  | "structure"
  | "viralHooks"
  | "compare"
  | "sessionList";

/** Short how-to under a scripts card title */
export function ScriptSectionGuide({ section }: { section: ScriptGuideKey }) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs space-y-1.5 leading-relaxed">
      <p className="text-muted-foreground">{t(`scripts.${section}How`)}</p>
      {locale === "uk" && t(`scripts.${section}HowEn`) && (
        <p className="text-muted-foreground/90 border-l-2 border-primary/30 pl-3">
          {t(`scripts.${section}HowEn`)}
        </p>
      )}
    </div>
  );
}
