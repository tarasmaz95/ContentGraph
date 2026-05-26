"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { ScriptSectionGuide } from "@/components/scripts/script-section-guide";
import { useT } from "@/lib/i18n";
import { compareScript } from "@/services/api";
import type { ScriptCompareResult, ScriptGenerateResult } from "@/types/scripts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ScriptCompareProps {
  lastGenerated: ScriptGenerateResult | null;
}

/** Compare generated script vs creator style and top videos */
export function ScriptCompare({ lastGenerated }: ScriptCompareProps) {
  const t = useT();
  const [result, setResult] = useState<ScriptCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!lastGenerated) return;
    setLoading(true);
    setError(null);
    try {
      setResult(
        await compareScript({
          creator_name: lastGenerated.creator_name,
          generated_script: lastGenerated.structure.full_script,
          topic: lastGenerated.topic,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("scripts.compareFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/10">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">{t("scripts.compareTitle")}</CardTitle>
        <CardDescription>{t("scripts.compareDesc")}</CardDescription>
        <ScriptSectionGuide section="compare" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          size="lg"
          className="w-full gap-2 font-semibold sm:w-auto"
          onClick={() => void run()}
          disabled={loading || !lastGenerated}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("scripts.compareRun")}
        </Button>
        {!lastGenerated && (
          <p className="text-sm text-muted-foreground">{t("scripts.compareNeedGenerate")}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">{result.summary}</p>
            <p>
              <span className="font-semibold">{t("scripts.compareStyle")}: </span>
              {result.style_alignment}
            </p>
            <p>
              <span className="font-semibold">{t("scripts.compareHooks")}: </span>
              {result.hook_alignment}
            </p>
            <TagList label={t("scripts.compareStrengths")} items={result.strengths} />
            <TagList label={t("scripts.compareGaps")} items={result.gaps} />
            <TagList label={t("scripts.compareTopVideos")} items={result.top_video_references} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <ul className="list-inside list-disc">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
