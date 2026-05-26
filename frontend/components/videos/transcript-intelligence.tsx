"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";

import { useToast } from "@/components/convenience/toast-provider";
import { copyToClipboard } from "@/lib/clipboard";
import { useT } from "@/lib/i18n";
import type { TranscriptIntelligence as TranscriptIntelligenceType } from "@/types/video-intelligence";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TranscriptIntelligenceProps {
  data: TranscriptIntelligenceType;
  /** Highlight query terms from semantic search */
  highlightQuery?: string;
  fullText?: string;
}

/** Transcript preview with copy, collapse, keyword highlight */
export function TranscriptIntelligence({
  data,
  highlightQuery = "",
  fullText,
}: TranscriptIntelligenceProps) {
  const t = useT();
  const { showCopied } = useToast();
  const [expanded, setExpanded] = useState(false);
  const body = fullText || data.preview || "";

  const highlighted = useMemo(
    () => highlightText(body, highlightQuery),
    [body, highlightQuery],
  );

  useEffect(() => {
    if (!highlightQuery.trim() || !body) return;
    setExpanded(true);
    const timer = setTimeout(() => {
      const el = document.getElementById("cg-transcript-body");
      const mark = el?.querySelector("mark");
      mark?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(timer);
  }, [highlightQuery, body]);

  const copyText = body || data.preview;

  const handleCopy = async () => {
    if (!copyText) return;
    const ok = await copyToClipboard(copyText);
    if (ok) showCopied();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-lg">{t("convenience.transcriptTitle")}</CardTitle>
          <CardDescription>
            {data.full_available
              ? t("convenience.transcriptAvailable")
              : t("convenience.transcriptMissing")}
          </CardDescription>
        </div>
        {copyText && (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
            <Copy className="h-4 w-4" />
            {t("convenience.copyTranscript")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {body && (
          <div>
            <button
              type="button"
              className="mb-2 flex items-center gap-1 text-xs font-medium text-primary"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {expanded ? t("convenience.collapse") : t("convenience.expandTranscript")}
            </button>
            <div
              id="cg-transcript-body"
              className={`overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed ${
                expanded ? "max-h-[420px]" : "max-h-40"
              }`}
            >
              {highlighted}
            </div>
          </div>
        )}

        {data.key_moments.length > 0 && (
          <Section title={t("convenience.keyMoments")}>
            {data.key_moments.map((m) => (
              <div key={m.label + m.excerpt} className="border-l-2 border-primary pl-3 py-2">
                <p className="text-xs font-medium text-primary">{m.label}</p>
                <p className="text-muted-foreground">{highlightPlain(m.excerpt, highlightQuery)}</p>
              </div>
            ))}
          </Section>
        )}

        <TagSection title={t("convenience.strongestInsights")} items={data.strongest_insights} />
        <TagSection title={t("convenience.repeatedThemes")} items={data.repeated_themes} />
        <TagSection title={t("convenience.ctaSections")} items={data.cta_sections} />
        <TagSection title={t("convenience.emotionalPhrases")} items={data.emotional_phrases} />
      </CardContent>
    </Card>
  );
}

function highlightText(text: string, query: string): ReactNode {
  if (!query.trim() || !text) return text;
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  if (!terms.length) return text;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  const termSet = new Set(terms.map((t) => t.toLowerCase()));
  return parts.map((part, i) =>
    termSet.has(part.toLowerCase()) ? (
      <mark key={i} className="rounded bg-yellow-200/80 px-0.5 dark:bg-yellow-900/50">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function highlightPlain(text: string, query: string): ReactNode {
  return highlightText(text, query);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function TagSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ul className="mt-1 list-inside list-disc text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
