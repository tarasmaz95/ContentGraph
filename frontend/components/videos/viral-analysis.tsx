import type { ViralAnalysis as ViralAnalysisType } from "@/types/video-intelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ViralAnalysisProps {
  viral: ViralAnalysisType;
}

/** Viral factors, frameworks, keywords */
export function ViralAnalysis({ viral }: ViralAnalysisProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Viral Analysis</CardTitle>
        <CardDescription>Reusable patterns and emotional drivers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ListSection title="Viral factors" items={viral.viral_factors} />
        <ListSection title="Reusable frameworks" items={viral.reusable_frameworks} />
        <ListSection title="Creator patterns" items={viral.creator_patterns} />
        <TagSection title="Emotional triggers" items={viral.emotional_triggers} />
        {viral.top_keywords.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Top keywords</p>
            <div className="mt-2 space-y-1">
              {viral.top_keywords.slice(0, 10).map((k) => (
                <div key={k.keyword} className="flex justify-between">
                  <span>{k.keyword}</span>
                  <span className="text-muted-foreground">{k.count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ul className="mt-1 list-inside list-disc">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TagSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded bg-primary/10 px-2 py-0.5 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
