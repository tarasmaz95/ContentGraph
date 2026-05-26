"use client";

import { Info } from "lucide-react";

import { useLocale, useT } from "@/lib/i18n";

/** How to use Copilot Chat — what to type and what to expect. */
export function ChatIntro() {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 text-sm space-y-4"
      role="note"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-foreground">{t("chat.guideTitle")}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("chat.guideBody")}</p>
        </div>
      </div>

      <ol className="grid gap-4 text-xs text-muted-foreground sm:grid-cols-3">
        <li className="space-y-1.5">
          <p className="font-semibold text-foreground">{t("chat.guideStep1Title")}</p>
          <p className="leading-relaxed">{t("chat.guideStep1")}</p>
        </li>
        <li className="space-y-1.5">
          <p className="font-semibold text-foreground">{t("chat.guideStep2Title")}</p>
          <ul className="space-y-1 leading-relaxed list-none">
            <li>{t("chat.guideStep2Creator")}</li>
            <li>{t("chat.guideStep2Hooks")}</li>
            <li>{t("chat.guideStep2Video")}</li>
            <li>{t("chat.guideStep2Audience")}</li>
            <li>{t("chat.guideStep2General")}</li>
          </ul>
        </li>
        <li className="space-y-1.5">
          <p className="font-semibold text-foreground">{t("chat.guideStep3Title")}</p>
          <ul className="space-y-1 leading-relaxed list-none">
            <li>{t("chat.guideStep3Insights")}</li>
            <li>{t("chat.guideStep3Sources")}</li>
            <li>{t("chat.guideStep3Summary")}</li>
            <li>{t("chat.guideStep3FollowUps")}</li>
            <li>{t("chat.guideStep3Save")}</li>
          </ul>
        </li>
      </ol>

      <p className="text-xs text-muted-foreground leading-relaxed border-t border-primary/15 pt-3">
        {t("chat.guideFootnote")}
      </p>
      {locale === "uk" && (
        <p className="text-xs text-muted-foreground/90 leading-relaxed border-l-2 border-primary/30 pl-3">
          {t("chat.guideFootnoteEn")}
        </p>
      )}
    </div>
  );
}
