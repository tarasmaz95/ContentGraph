import type { VideoBreakdown as VideoBreakdownType } from "@/types/video-intelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoBreakdownProps {
  breakdown: VideoBreakdownType;
}

/** AI performance breakdown sections */
export function VideoBreakdown({ breakdown }: VideoBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">AI Video Breakdown</CardTitle>
        <CardDescription>Why this video performed — hooks, story, pacing, audience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Block title="Why it performed" text={breakdown.why_performed} />
        <Block title="Hook effectiveness" text={breakdown.hook_effectiveness} />
        <Block title="Pacing" text={breakdown.pacing} />
        <Block title="Communication style" text={breakdown.communication_style} />
        <Block title="Audience targeting" text={breakdown.audience_targeting} />
        <TagSection label="Emotional triggers" items={breakdown.emotional_triggers} />
        <TagSection label="Storytelling patterns" items={breakdown.storytelling_patterns} />
        <TagSection label="CTA patterns" items={breakdown.cta_patterns} />
        {breakdown.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Recommendations
            </p>
            <ul className="mt-2 list-inside list-disc">
              {breakdown.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function TagSection({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded bg-muted px-2 py-0.5 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
