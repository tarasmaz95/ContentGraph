import { SaveInsightButton } from "@/components/research/save-insight-button";
import { formatHooksForSave } from "@/lib/research-format";
import type { HookPattern } from "@/types/hooks";
import { HOOK_TYPE_LABELS } from "@/types/hooks";

interface HookPatternListProps {
  patterns: HookPattern[];
  saveLabel?: string;
  saveTitle?: string;
  showSaveCollection?: boolean;
  metricsHint?: string;
}

/** List of extracted hooks with optional bulk save to Research */
export function HookPatternList({
  patterns,
  saveLabel = "Save Hook Set",
  saveTitle = "Viral Hook Set",
  showSaveCollection = false,
  metricsHint,
}: HookPatternListProps) {
  if (patterns.length === 0) {
    return <p className="text-sm text-muted-foreground">No hooks indexed yet — run Sheets sync.</p>;
  }

  return (
    <div className="space-y-3">
      {metricsHint && (
        <p className="text-xs text-muted-foreground leading-relaxed">{metricsHint}</p>
      )}
      {showSaveCollection && (
        <div className="flex justify-end">
          <SaveInsightButton
            insightText={formatHooksForSave(saveTitle, patterns)}
            sourceType="hook_collection"
            sourceReference={saveTitle}
            tags={["hooks", "viral"]}
            label={saveLabel}
          />
        </div>
      )}
      <ul className="divide-y rounded-md border text-sm">
        {patterns.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {HOOK_TYPE_LABELS[p.hook_type] ?? p.hook_type}
                </span>
                <p className="mt-1 font-medium leading-snug">{p.hook_text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.creator_name} · {p.views_count.toLocaleString()} views · eff{" "}
                  {(p.effectiveness_score * 100).toFixed(0)}% · conf{" "}
                  {(p.confidence_score * 100).toFixed(0)}%
                </p>
              </div>
              <SaveInsightButton
                insightText={formatHooksForSave(`Hook: ${p.hook_type}`, [p])}
                sourceType="hook_favorite"
                sourceReference={p.video_title.slice(0, 80)}
                tags={[p.hook_type, p.creator_name]}
                label="Save"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
