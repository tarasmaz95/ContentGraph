"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Copy, Download, Loader2, Search } from "lucide-react";
import { Suspense } from "react";

import { ResearchAssistant } from "@/components/copilot/research-assistant";
import { InsightList } from "@/components/research/insight-list";
import { NoteEditor } from "@/components/research/note-editor";
import { NoteList } from "@/components/research/note-list";
import { ResearchWorkspaceView } from "@/components/research/research-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PromptChips } from "@/components/ui/prompt-chips";
import { getPagePrompts, useLocale, useT } from "@/lib/i18n";
import { runExamplePrompt } from "@/lib/prompt-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copyToClipboard } from "@/lib/clipboard";
import {
  deleteInsight,
  deleteResearchNote,
  exportResearchMarkdown,
  fetchResearchWorkspace,
  searchResearch,
} from "@/services/api";
import type { ResearchSearchResult, ResearchWorkspace } from "@/types/research";

function ResearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const { locale } = useLocale();
  const pagePrompts = getPagePrompts(locale).research;
  const [workspace, setWorkspace] = useState<ResearchWorkspace | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ResearchSearchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const initialItemId = (() => {
    const raw = searchParams.get("item");
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorkspace(await fetchResearchWorkspace());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchResults(await searchResearch(searchQuery.trim()));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { markdown } = await exportResearchMarkdown();
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contentgraph-research.md";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    const { markdown } = await exportResearchMarkdown();
    const ok = await copyToClipboard(markdown);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || !workspace) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasSnapshots = workspace.items.length > 0;
  const isEmpty =
    !hasSnapshots &&
    workspace.insights.length === 0 &&
    workspace.notes.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={BookOpen}
        title={t("research.title")}
        description={t("research.descriptionMvp")}
        helpKey="research_workspace"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void handleCopy()}>
              <Copy className="h-4 w-4" />
              {copied ? t("common.copied") : t("research.copyMarkdown")}
            </Button>
            <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
              <Download className="h-4 w-4" />
              {t("research.exportMd")}
            </Button>
          </div>
        }
      />

      <PromptChips prompts={pagePrompts} onSelect={(p) => runExamplePrompt(router, p)} />

      {isEmpty && (
        <EmptyState
          icon={BookOpen}
          title={t("research.emptyTitle")}
          description={t("research.emptyDescMvp")}
          prompts={pagePrompts}
          onPrompt={(p) => runExamplePrompt(router, p)}
          links={[
            { label: t("research.openCompare"), href: "/compare" },
            { label: t("research.browseCreators"), href: "/creators" },
          ]}
        />
      )}

      <ResearchWorkspaceView
        workspace={workspace}
        onRefresh={() => void load()}
        initialItemId={initialItemId}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("research.searchTitle")}</CardTitle>
          <CardDescription>{t("research.searchDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder={t("research.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
          />
          <Button variant="secondary" onClick={() => void handleSearch()}>
            <Search className="h-4 w-4" />
          </Button>
        </CardContent>
        {searchResults && (
          <CardContent className="border-t pt-4">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("research.noMatches")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {searchResults.map((r) => (
                  <li key={`${r.kind}-${r.id}`} className="rounded border p-2">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-muted-foreground"> · {r.kind}</span>
                    <p className="line-clamp-2 text-muted-foreground">{r.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      <ResearchAssistant />

      <Button variant="ghost" size="sm" onClick={() => setShowLegacy((v) => !v)}>
        {showLegacy ? t("research.hideLegacy") : t("research.showLegacy")}
      </Button>

      {showLegacy && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-lg font-semibold">{t("research.savedInsights")}</h2>
            <InsightList
              items={workspace.insights}
              onDelete={async (id) => {
                await deleteInsight(id);
                void load();
              }}
            />
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold">{t("research.researchNotes")}</h2>
            <NoteEditor onCreated={() => void load()} />
            <div className="mt-4">
              <NoteList
                notes={workspace.notes}
                onDelete={async (id) => {
                  await deleteResearchNote(id);
                  void load();
                }}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResearchPageInner />
    </Suspense>
  );
}
