import type { StructureAnalysis as StructureAnalysisType } from "@/types/video-intelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StructureAnalysisProps {
  structure: StructureAnalysisType;
}

/** Hook → intro → sections → CTA → closing */
export function StructureAnalysis({ structure }: StructureAnalysisProps) {
  const blocks = [
    { label: "Hook", text: structure.hook },
    { label: "Intro", text: structure.intro },
    ...structure.key_sections.map((s) => ({ label: s.section, text: s.summary })),
    ...structure.transitions.map((t, i) => ({ label: `Transition ${i + 1}`, text: t })),
    { label: "CTA", text: structure.cta },
    { label: "Closing", text: structure.closing },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Structure Analysis</CardTitle>
        <CardDescription>How the video is organized from hook to close</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {blocks.map(
          (b) =>
            b.text && (
              <div key={b.label} className="rounded-md border px-3 py-2">
                <p className="text-xs font-semibold text-primary">{b.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ),
        )}
      </CardContent>
    </Card>
  );
}
