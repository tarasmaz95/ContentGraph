"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { ScriptAnalyticsCard } from "@/components/scripts/script-analytics-card";
import { ScriptSectionGuide } from "@/components/scripts/script-section-guide";
import { SaveInsightButton } from "@/components/research/save-insight-button";
import {
  formatHooksForSave,
  formatScriptForSave,
  formatScriptStructureForSave,
} from "@/lib/research-format";
import { useT } from "@/lib/i18n";
import { fetchScriptWorkspace, generateScript } from "@/services/api";
import type { ScriptGenerateResult } from "@/types/scripts";
import { HOOK_TYPE_OPTIONS } from "@/types/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ScriptGeneratorProps {
  onGenerated: (result: ScriptGenerateResult) => void;
  onCreatorChange?: (creator: string) => void;
  initialCreator?: string;
}

/** Creator-aware script generation form */
export function ScriptGenerator({
  onGenerated,
  onCreatorChange,
  initialCreator = "",
}: ScriptGeneratorProps) {
  const t = useT();
  const [creators, setCreators] = useState<string[]>([]);
  const [creator, setCreator] = useState(initialCreator);
  const [topic, setTopic] = useState("identity transformation");
  const [tone, setTone] = useState("philosophical");
  const [duration, setDuration] = useState("10 minutes");
  const [hookType, setHookType] = useState("curiosity");
  const [result, setResult] = useState<ScriptGenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchScriptWorkspace().then((ws) => setCreators(ws.creators));
  }, []);

  useEffect(() => {
    if (initialCreator) setCreator(initialCreator);
  }, [initialCreator]);

  const run = async () => {
    if (!creator.trim() || !topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const gen = await generateScript({
        creator_name: creator.trim(),
        topic: topic.trim(),
        tone,
        duration,
        hook_type: hookType,
      });
      setResult(gen);
      onGenerated(gen);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("scripts.generatorFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("scripts.generatorTitle")}
        </CardTitle>
        <CardDescription>{t("scripts.generatorDesc")}</CardDescription>
        <ScriptSectionGuide section="generator" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("scripts.generatorFieldCreator")}>
            <select
              className={selectClassName}
              value={creator}
              onChange={(e) => {
                setCreator(e.target.value);
                onCreatorChange?.(e.target.value);
              }}
            >
              <option value="">{t("scripts.generatorSelectCreator")}</option>
              {creators.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t("scripts.generatorFieldType")}>
            <select
              className={selectClassName}
              value={hookType}
              onChange={(e) => setHookType(e.target.value)}
            >
              {HOOK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>

          <p className="sm:col-span-2 -mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("scripts.generatorFieldCreatorHint")}
          </p>

          <FormField label={t("scripts.generatorFieldTopic")} className="sm:col-span-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("scripts.generatorTopicPlaceholder")}
            />
          </FormField>

          <FormField label={t("scripts.generatorFieldTone")}>
            <Input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder={t("scripts.generatorTonePlaceholder")}
            />
          </FormField>

          <FormField label={t("scripts.generatorFieldDuration")}>
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={t("scripts.generatorDurationPlaceholder")}
            />
          </FormField>

          <Button
            size="lg"
            className="sm:col-span-2 w-full gap-2 font-semibold"
            onClick={() => void run()}
            disabled={loading || !creator.trim()}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("scripts.generatorRun")}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <SaveInsightButton
                insightText={formatScriptForSave(result)}
                sourceType="script_generated"
                sourceReference={`${result.creator_name} · ${result.topic}`}
                tags={[result.creator_name, "script"]}
                label={t("scripts.generatorSave")}
              />
              <SaveInsightButton
                insightText={formatScriptStructureForSave(
                  result.creator_name,
                  result.structure,
                )}
                sourceType="script_structure"
                sourceReference={result.topic}
                tags={[result.creator_name, "structure"]}
                label={t("scripts.generatorSaveStructure")}
              />
              {result.viral_hooks_used.length > 0 && (
                <SaveInsightButton
                  insightText={formatHooksForSave("Viral hooks used", result.viral_hooks_used)}
                  sourceType="hook_collection"
                  sourceReference={result.selected_hook}
                  tags={[result.hook_type]}
                  label={t("scripts.generatorSaveHooks")}
                />
              )}
            </div>

            <ScriptAnalyticsCard analytics={result.analytics} />

            {result.style_notes && (
              <p className="text-sm text-muted-foreground">{result.style_notes}</p>
            )}

            <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/20 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {result.structure.full_script}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
