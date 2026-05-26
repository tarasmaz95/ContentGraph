import { Trash2 } from "lucide-react";

import type { SavedInsight } from "@/types/research";
import { Button } from "@/components/ui/button";

interface InsightListProps {
  items: SavedInsight[];
  onDelete?: (id: number) => void;
  emptyMessage?: string;
}

export function InsightList({
  items,
  onDelete,
  emptyMessage = "No saved insights yet.",
}: InsightListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border bg-card p-4 text-sm">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
              {item.source_type.replace(/_/g, " ")}
            </span>
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <p className="leading-relaxed">{item.insight_text}</p>
          {item.source_reference && (
            <p className="mt-1 text-xs text-muted-foreground">{item.source_reference}</p>
          )}
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
