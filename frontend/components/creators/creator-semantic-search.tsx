"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import { creatorSemanticSearch } from "@/services/api";
import type { Video } from "@/types/video";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CreatorSemanticSearchProps {
  creatorSlug: string;
}

/** Semantic search scoped to this creator's titles + transcripts */
export function CreatorSemanticSearch({ creatorSlug }: CreatorSemanticSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await creatorSemanticSearch(creatorSlug, q, 15));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Creator Semantic Search</CardTitle>
        <CardDescription>
          Search only this creator&apos;s videos — e.g. &quot;identity transformation&quot;,
          &quot;discipline&quot;, &quot;AI productivity&quot;
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Natural language query…"
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {results.length > 0 && (
          <ul className="max-h-72 divide-y overflow-y-auto rounded-md border text-sm">
            {results.map((v) => (
              <li key={v.id} className="px-3 py-3">
                <p className="font-medium leading-snug">{v.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.views_count.toLocaleString()} views
                  {v.similarity_score != null
                    ? ` · ${(v.similarity_score * 100).toFixed(0)}% match`
                    : ""}
                  {v.match_source ? ` · via ${v.match_source}` : ""}
                </p>
                {v.transcript_preview && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {v.transcript_preview}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
