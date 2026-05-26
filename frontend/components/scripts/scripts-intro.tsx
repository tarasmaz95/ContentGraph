"use client";

import { Info } from "lucide-react";

import { useLocale, useT } from "@/lib/i18n";

/** Top-of-page guide for /scripts */
export function ScriptsIntro() {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 text-sm space-y-3"
      role="note"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-foreground">{t("scripts.introTitle")}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("scripts.introBody")}</p>
        </div>
      </div>
      <ol className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <span className="font-semibold text-foreground">{t("scripts.introStep1Title")}</span>
          {" — "}
          {t("scripts.introStep1")}
        </li>
        <li>
          <span className="font-semibold text-foreground">{t("scripts.introStep2Title")}</span>
          {" — "}
          {t("scripts.introStep2")}
        </li>
        <li>
          <span className="font-semibold text-foreground">{t("scripts.introStep3Title")}</span>
          {" — "}
          {t("scripts.introStep3")}
        </li>
      </ol>
      {locale === "uk" && (
        <p className="text-xs text-muted-foreground/90 border-l-2 border-primary/30 pl-3 leading-relaxed">
          {t("scripts.introEn")}
        </p>
      )}
    </div>
  );
}
