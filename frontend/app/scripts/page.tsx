"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { GeneratedScriptsList } from "@/components/scripts/generated-scripts-list";
import { ScriptsIntro } from "@/components/scripts/scripts-intro";
import { HookPatternList } from "@/components/hooks/hook-pattern-list";
import { ScriptCompare } from "@/components/scripts/script-compare";
import { ScriptGenerator } from "@/components/scripts/script-generator";
import { ScriptStructurePanel } from "@/components/scripts/script-structure-panel";
import { ScriptStylePanel } from "@/components/scripts/script-style-panel";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PromptChips } from "@/components/ui/prompt-chips";
import { getPagePrompts, useLocale, useT } from "@/lib/i18n";
import { runExamplePrompt } from "@/lib/prompt-actions";
import { fetchScriptWorkspace } from "@/services/api";
import type { GeneratedScriptEntry, ScriptGenerateResult, ScriptWorkspace } from "@/types/scripts";

/**
 * AI Script Intelligence — /scripts
 *
 * Creator-aware generation using hooks, transcripts, titles, and style patterns.
 */
export default function ScriptsPage() {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const pagePrompts = getPagePrompts(locale).scripts;
  const [workspace, setWorkspace] = useState<ScriptWorkspace | null>(null);
  const [selectedCreator, setSelectedCreator] = useState("");
  const [lastGenerated, setLastGenerated] = useState<ScriptGenerateResult | null>(null);
  const [generatedList, setGeneratedList] = useState<GeneratedScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(async (creator?: string) => {
    setLoading(true);
    try {
      setWorkspace(await fetchScriptWorkspace(creator));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleGenerated = (result: ScriptGenerateResult) => {
    setLastGenerated(result);
    setGeneratedList((prev) => [
      {
        id: `${Date.now()}`,
        result,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    void loadWorkspace(result.creator_name);
  };

  const handleCreatorChange = (creator: string) => {
    setSelectedCreator(creator);
    if (creator) void loadWorkspace(creator);
  };

  if (loading && !workspace) {
    return (
      <div className="space-y-6">
        <PageHeader icon={FileText} title={t("scripts.title")} />
        <PageSkeleton rows={2} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={FileText}
        title={t("scripts.title")}
        description={t("scripts.description")}
      />

      <ScriptsIntro />

      <PromptChips
        prompts={pagePrompts}
        onSelect={(p) => runExamplePrompt(router, p)}
      />

      <ScriptGenerator
        onGenerated={handleGenerated}
        onCreatorChange={handleCreatorChange}
        initialCreator={selectedCreator}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ScriptStylePanel style={workspace?.creator_style ?? null} />
        <ScriptStructurePanel
          structure={workspace?.default_structure ?? {
            opening_hook: "",
            intro: "",
            key_points: [],
            transitions: [],
            cta: "",
            closing: "",
            full_script: "",
          }}
          notes={workspace?.structure_template_notes}
        />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("scripts.viralHooksTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {t("scripts.viralHooksExplain")}
          </p>
        </div>
        <HookPatternList
          patterns={workspace?.viral_hooks ?? []}
          saveTitle="Script viral hooks"
          showSaveCollection
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScriptCompare lastGenerated={lastGenerated} />
        <GeneratedScriptsList scripts={generatedList} />
      </div>
    </div>
  );
}
