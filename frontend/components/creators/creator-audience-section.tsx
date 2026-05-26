"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import type { CreatorAudienceIntel } from "@/types/creator-intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export function CreatorAudienceSection({ audience }: { audience: CreatorAudienceIntel }) {
  const t = useT();

  if (audience.total_comments === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("creators.audienceEmpty")}</p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ListCard title={t("creators.topComments")} items={audience.top_comments.map((c) => (
        <li key={c.id} className="space-y-1 rounded bg-muted/40 px-2 py-2">
          <p className="text-xs text-muted-foreground">
            {c.author_name} · {c.likes_count.toLocaleString()} likes
          </p>
          <p className="text-sm">{c.comment_text.slice(0, 160)}</p>
          <Link href={`/videos/${c.video_id}`} className="text-xs text-primary underline">
            View video
          </Link>
        </li>
      ))} />

      <div className="space-y-4">
        <ListCard title={t("creators.painPoints")} items={audience.pain_points.map((p) => (
          <li key={p} className="rounded bg-muted/40 px-2 py-1 text-sm">{p}</li>
        ))} />
        <ListCard title={t("creators.repeatedPhrases")} items={audience.repeated_phrases.map((p) => (
          <li key={p} className="rounded bg-muted/40 px-2 py-1 text-sm">{p}</li>
        ))} />
        <ListCard title={t("creators.emotionalPatterns")} items={audience.emotional_patterns.map((p) => (
          <li key={p} className="rounded bg-muted/40 px-2 py-1 text-sm">{p}</li>
        ))} />
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: ReactNode[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">{items.length ? items : <li className="text-sm text-muted-foreground">—</li>}</ul>
      </CardContent>
    </Card>
  );
}
