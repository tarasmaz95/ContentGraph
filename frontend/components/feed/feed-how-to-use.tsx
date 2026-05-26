"use client";

import { ChevronDown } from "lucide-react";

import { useT } from "@/lib/i18n";

export function FeedHowToUse() {
  const t = useT();

  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
        <span>{t("feed.howTo.title")}</span>
      </summary>
      <ul className="mt-2 space-y-1 pl-5 text-muted-foreground leading-relaxed">
        <li className="list-disc">{t("feed.howTo.point1")}</li>
        <li className="list-disc">{t("feed.howTo.point2")}</li>
        <li className="list-disc">{t("feed.howTo.point3")}</li>
      </ul>
    </details>
  );
}
