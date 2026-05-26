"use client";

import type { CreatorHookIntel } from "@/types/creator-intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

const MIX_KEYS = [
  ["curiosity_pct", "creators.hookCuriosity"],
  ["transformation_pct", "creators.hookTransformation"],
  ["urgency_pct", "creators.hookUrgency"],
  ["numbers_pct", "creators.hookNumbers"],
  ["authority_pct", "creators.hookAuthority"],
  ["identity_pct", "creators.hookIdentity"],
  ["emotional_pct", "creators.hookEmotional"],
  ["how_to_pct", "creators.hookHowTo"],
] as const;

export function CreatorHooksIntel({ hooks }: { hooks: CreatorHookIntel }) {
  const t = useT();
  const mix = hooks.mix;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MIX_KEYS.map(([key, labelKey]) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
              <p className="text-xl font-semibold tabular-nums">
                {mix[key as keyof typeof mix].toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hooks.best_performing_hooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("creators.bestHooks")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {hooks.best_performing_hooks.map((h) => (
                <li key={h} className="rounded bg-muted/40 px-2 py-1">
                  {h}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
