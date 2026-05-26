"use client";

import { ScriptSectionGuide } from "@/components/scripts/script-section-guide";
import { useT } from "@/lib/i18n";
import type { CreatorStyleContext } from "@/types/scripts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ScriptStylePanelProps {
  style: CreatorStyleContext | null;
}

/** Creator DNA used for script generation */
export function ScriptStylePanel({ style }: ScriptStylePanelProps) {
  const t = useT();

  if (!style) {
    return (
      <Card className="border-primary/10">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">{t("scripts.styleEmptyTitle")}</CardTitle>
          <CardDescription>{t("scripts.styleEmptyDesc")}</CardDescription>
          <ScriptSectionGuide section="style" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">
          {t("scripts.styleTitle")} — {style.creator_name}
        </CardTitle>
        <CardDescription>{t("scripts.styleDesc")}</CardDescription>
        <ScriptSectionGuide section="style" />
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Row label={t("scripts.styleContent")} value={style.content_style} />
        <Row label={t("scripts.styleCommunication")} value={style.communication_style} />
        <TagSection label={t("scripts.styleTopics")} items={style.top_topics} />
        <TagSection label={t("scripts.styleHookPatterns")} items={style.hook_patterns} />
        <TagSection label={t("scripts.styleVocabulary")} items={style.vocabulary} />
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t("scripts.styleSampleTitles")}
          </p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {style.sample_titles.slice(0, 5).map((title) => (
              <li key={title} className="line-clamp-1">
                {title}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t("scripts.styleTranscript")}
          </p>
          {style.transcript_excerpts.slice(0, 2).map((ex, i) => (
            <p key={i} className="mt-1 line-clamp-3 text-xs italic text-muted-foreground">
              «{ex}»
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function TagSection({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded bg-muted px-2 py-0.5 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
