"use client";

import { useMemo, useState } from "react";
import { FolderPlus, Loader2, Trash2 } from "lucide-react";

import { ResearchItemDetail } from "@/components/research/research-item-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import {
  createResearchCollection,
  deleteResearchItem,
  fetchResearchWorkspace,
} from "@/services/api";
import type { ResearchItem, ResearchWorkspace } from "@/types/research";

interface ResearchWorkspaceViewProps {
  workspace: ResearchWorkspace;
  onRefresh: () => void;
  initialItemId?: number | null;
}

export function ResearchWorkspaceView({
  workspace,
  onRefresh,
  initialItemId = null,
}: ResearchWorkspaceViewProps) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<number | null>(
    initialItemId ??
      workspace.timeline[0]?.id ??
      workspace.items[0]?.id ??
      null,
  );
  const [collectionFilter, setCollectionFilter] = useState<number | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const filteredItems = useMemo(() => {
    if (collectionFilter === null) return workspace.items;
    return workspace.items.filter((i) => i.collection_id === collectionFilter);
  }, [workspace.items, collectionFilter]);

  const selected = workspace.items.find((i) => i.id === selectedId) ?? null;

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setCreatingCollection(true);
    try {
      await createResearchCollection(newCollectionName.trim());
      setNewCollectionName("");
      onRefresh();
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    await deleteResearchItem(id);
    if (selectedId === id) setSelectedId(null);
    onRefresh();
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 space-y-4 lg:w-56">
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("research.collections")}</h3>
          <button
            type="button"
            className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-sm ${
              collectionFilter === null ? "bg-primary/10 font-medium" : "hover:bg-muted/50"
            }`}
            onClick={() => setCollectionFilter(null)}
          >
            {t("research.allItems")} ({workspace.items.length})
          </button>
          {workspace.collections.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-sm ${
                collectionFilter === c.id ? "bg-primary/10 font-medium" : "hover:bg-muted/50"
              }`}
              onClick={() => setCollectionFilter(c.id)}
            >
              {c.name} ({c.item_count})
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            placeholder={t("research.newCollection")}
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={creatingCollection}
            onClick={() => void handleCreateCollection()}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4 lg:max-w-xs">
        <h3 className="text-sm font-semibold">{t("research.timeline")}</h3>
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("research.noItems")}</p>
        ) : (
          <ul className="space-y-1">
            {filteredItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                active={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
                onDelete={() => void handleDeleteItem(item.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <main className="min-w-0 flex-[2] rounded-lg border border-border/60 bg-card p-4">
        {selected ? (
          <ResearchItemDetail
            item={selected}
            onUpdated={() => onRefresh()}
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("research.selectItem")}
          </p>
        )}
      </main>
    </div>
  );
}

function ItemRow({
  item,
  active,
  onSelect,
  onDelete,
}: {
  item: ResearchItem;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`flex items-start gap-1 rounded-md border px-2 py-2 text-sm ${
        active ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/40"
      }`}
    >
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <span className="block truncate font-medium">{item.title}</span>
        <span className="text-[10px] text-muted-foreground">{item.type}</span>
      </button>
      <button
        type="button"
        className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/** Reload workspace from API */
export async function loadResearchWorkspace(): Promise<ResearchWorkspace> {
  return fetchResearchWorkspace();
}
