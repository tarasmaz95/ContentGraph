"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { HookToolGuide } from "@/components/hooks/hook-tool-guide";
import { SaveInsightButton } from "@/components/research/save-insight-button";
import { formatGeneratedHooksForSave } from "@/lib/research-format";
import { useT } from "@/lib/i18n";
import { generateHooks, fetchCreators } from "@/services/api";
import type { HookGenerateResult } from "@/types/hooks";
import { HOOK_TYPE_OPTIONS } from "@/types/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** AI hook generator — creator style, topic, type, tone */
export function HookGenerator() {
  const t = useT();
  const [creators, setCreators] = useState<string[]>([]);
  const [creator, setCreator] = useState("");
  const [topic, setTopic] = useState("identity transformation");
  const [hookType, setHookType] = useState("curiosity");
  const [tone, setTone] = useState("bold");
  const [result, setResult] = useState<HookGenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCreators = async () => {
    const list = await fetchCreators();
    setCreators(list.map((c) => c.creator_name));
  };

  const run = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (creators.length === 0) await loadCreators();
      const gen = await generateHooks({
        creator_name: creator,
        topic: topic.trim(),
        hook_type: hookType,
        tone,
      });
      setResult(gen);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("hooks.generatorFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("hooks.generatorTitle")}
        </CardTitle>
        <CardDescription>{t("hooks.generatorDesc")}</CardDescription>
        <HookToolGuide variant="generator" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("hooks.generatorFieldCreator")}>
            <select
              className={selectClassName}
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              onFocus={() => void loadCreators()}
            >
              <option value="">{t("hooks.generatorAnyStyle")}</option>
              {creators.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t("hooks.generatorFieldType")}>
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
            {t("hooks.generatorFieldCreatorHint")}
          </p>

          <FormField label={t("hooks.generatorFieldTopic")} className="sm:col-span-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("hooks.generatorTopicPlaceholder")}
            />
          </FormField>

          <FormField label={t("hooks.generatorFieldTone")} className="sm:col-span-2">
            <Input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder={t("hooks.generatorTonePlaceholder")}
            />
          </FormField>

          <Button
            size="lg"
            className="sm:col-span-2 w-full gap-2 font-semibold"
            onClick={() => void run()}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("hooks.generatorRun")}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            {result.used_placeholder && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {t("hooks.generatorPlaceholderWarning")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t("hooks.generatorResultExplain")}</p>
            <div className="flex justify-end">
              <SaveInsightButton
                insightText={formatGeneratedHooksForSave(result)}
                sourceType="hook_generated"
                sourceReference={`${result.topic} · ${result.hook_type}`}
                tags={[result.hook_type, result.creator_name || "general"]}
                label={t("hooks.generatorSave")}
              />
            </div>
            {result.style_notes && (
              <p className="text-xs text-muted-foreground">{result.style_notes}</p>
            )}
            <ol className="list-inside list-decimal space-y-2 text-sm">
              {result.hooks.map((h) => (
                <li key={h} className="leading-snug">
                  {h}
                </li>
              ))}
            </ol>
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
