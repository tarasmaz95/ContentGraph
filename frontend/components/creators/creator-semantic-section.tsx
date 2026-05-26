"use client";

import Link from "next/link";

import type { CreatorSemanticIntel } from "@/types/creator-intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export function CreatorSemanticSection({ semantic }: { semantic: CreatorSemanticIntel }) {
  const t = useT();

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-sm font-medium">{t("creators.positioning")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{semantic.positioning_summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("creators.themes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {semantic.themes.map((theme) => (
                <li key={theme} className="rounded bg-muted/40 px-2 py-1">
                  {theme}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("creators.nearestCreators")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {semantic.nearest_creators.length === 0 ? (
                <li className="text-muted-foreground">—</li>
              ) : (
                semantic.nearest_creators.map((c) => (
                  <li key={c.creator_name} className="rounded bg-muted/40 px-2 py-2">
                    <Link
                      href={`/creators/${encodeURIComponent(c.creator_name)}`}
                      className="font-medium text-primary underline"
                    >
                      {c.creator_name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      overlap {(c.overlap_score * 100).toFixed(0)}% · {c.shared_topics.join(", ")}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
