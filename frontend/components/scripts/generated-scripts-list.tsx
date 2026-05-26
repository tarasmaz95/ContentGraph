"use client";

import { ScriptSectionGuide } from "@/components/scripts/script-section-guide";
import { SaveInsightButton } from "@/components/research/save-insight-button";
import { formatScriptForSave } from "@/lib/research-format";
import { useT } from "@/lib/i18n";
import type { GeneratedScriptEntry } from "@/types/scripts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GeneratedScriptsListProps {
  scripts: GeneratedScriptEntry[];
}

/** Session list of scripts generated on this page */
export function GeneratedScriptsList({ scripts }: GeneratedScriptsListProps) {
  const t = useT();

  if (scripts.length === 0) {
    return (
      <Card className="border-primary/10">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">{t("scripts.sessionListTitle")}</CardTitle>
          <CardDescription>{t("scripts.sessionListDesc")}</CardDescription>
          <ScriptSectionGuide section="sessionList" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("scripts.sessionListEmpty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">{t("scripts.sessionListTitle")}</CardTitle>
        <CardDescription>
          {t("scripts.sessionCount", { count: scripts.length })}
        </CardDescription>
        <ScriptSectionGuide section="sessionList" />
      </CardHeader>
      <CardContent className="space-y-4">
        {scripts.map((entry) => (
          <div key={entry.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {entry.result.creator_name} — {entry.result.topic}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.result.duration} · {entry.result.tone} · {entry.result.hook_type} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <SaveInsightButton
                insightText={formatScriptForSave(entry.result)}
                sourceType="script_generated"
                sourceReference={entry.result.topic}
                tags={[entry.result.creator_name]}
                label={t("scripts.sessionSave")}
              />
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
              {entry.result.structure.opening_hook}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
