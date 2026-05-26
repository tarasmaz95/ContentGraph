"use client";

import { ScriptSectionGuide } from "@/components/scripts/script-section-guide";
import { useT } from "@/lib/i18n";
import type { ScriptStructure } from "@/types/scripts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ScriptStructurePanelProps {
  structure: ScriptStructure;
  notes?: string;
}

/** Default script outline template */
export function ScriptStructurePanel({ structure, notes }: ScriptStructurePanelProps) {
  const t = useT();

  const sections = [
    { label: t("scripts.structureOpening"), text: structure.opening_hook },
    { label: t("scripts.structureIntro"), text: structure.intro },
    ...structure.key_points.map((p, i) => ({
      label: t("scripts.structureKeyPoint", { n: i + 1 }),
      text: p,
    })),
    ...structure.transitions.map((tr, i) => ({
      label: t("scripts.structureTransition", { n: i + 1 }),
      text: tr,
    })),
    { label: t("scripts.structureCta"), text: structure.cta },
    { label: t("scripts.structureClosing"), text: structure.closing },
  ];

  return (
    <Card className="border-primary/10">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">{t("scripts.structureTitle")}</CardTitle>
        <CardDescription>{notes ?? t("scripts.structureDesc")}</CardDescription>
        <ScriptSectionGuide section="structure" />
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((s) =>
          s.text ? (
            <div key={s.label} className="rounded-md border px-3 py-2">
              <p className="text-xs font-semibold text-primary">{s.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ) : null,
        )}
      </CardContent>
    </Card>
  );
}
