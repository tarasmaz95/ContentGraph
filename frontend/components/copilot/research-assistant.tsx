"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, Loader2 } from "lucide-react";

import { slugifyCreatorName } from "@/lib/creator-slug";
import { fetchResearchAssistant } from "@/services/api";
import type { ResearchAssistantHints } from "@/types/copilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResearchAssistantProps {
  activeTags?: string[];
  creatorName?: string | null;
}

/** Research workspace — related insights, tags, creators */
export function ResearchAssistant({ activeTags, creatorName }: ResearchAssistantProps) {
  const [hints, setHints] = useState<ResearchAssistantHints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setHints(await fetchResearchAssistant(activeTags, creatorName ?? undefined));
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTags, creatorName]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hints) return null;

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" />
          Research Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {hints.suggested_tags.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Suggested tags
            </p>
            <div className="flex flex-wrap gap-1">
              {hints.suggested_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {hints.related_creators.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Related creators
            </p>
            <ul className="space-y-1">
              {hints.related_creators.map((c) => (
                <li key={c}>
                  <Link
                    href={`/creators/${slugifyCreatorName(c)}`}
                    className="text-primary underline"
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hints.related_insights.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Related themes
            </p>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {hints.related_insights.map((line) => (
                <li key={line} className="line-clamp-2">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
