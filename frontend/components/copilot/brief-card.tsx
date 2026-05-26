"use client";

import type { AIBrief } from "@/types/copilot";
import { TrendBriefCard } from "@/components/copilot/trend-brief-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BriefCardProps {
  brief: AIBrief;
}

/** Scannable AI brief — headline, bullets, actions */
export function BriefCard({ brief }: BriefCardProps) {
  if (brief.brief_type === "trend") {
    return <TrendBriefCard brief={brief} />;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          {brief.brief_type} brief
        </p>
        <CardTitle className="text-sm leading-snug">{brief.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{brief.headline}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {brief.bullets.length > 0 && (
          <ul className="list-inside list-disc space-y-1">
            {brief.bullets.map((b) => (
              <li key={b.slice(0, 40)}>{b}</li>
            ))}
          </ul>
        )}
        {brief.actions.length > 0 && (
          <div>
            <p className="mb-1 font-semibold text-muted-foreground">Actions</p>
            <ul className="space-y-1">
              {brief.actions.map((a) => (
                <li key={a} className="rounded bg-background/80 px-2 py-1">
                  → {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
