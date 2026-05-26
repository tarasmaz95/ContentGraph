"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";

import { trackSavedTags } from "@/lib/personalization";
import { createResearchItem } from "@/services/api";
import type { ResearchItemCreate, ResearchItemType } from "@/types/research";
import { Button } from "@/components/ui/button";

interface SaveResearchButtonProps {
  type: ResearchItemType;
  title: string;
  payload: Record<string, unknown>;
  tags?: string[];
  collectionId?: number | null;
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
}

/** One-click save of immutable JSON snapshot to research workspace. */
export function SaveResearchButton({
  type,
  title,
  payload,
  tags = [],
  collectionId = null,
  label = "Save to Research",
  variant = "outline",
  size = "sm",
}: SaveResearchButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || loading) return;
    setLoading(true);
    try {
      const body: ResearchItemCreate = {
        type,
        title: title.trim(),
        payload_json: payload,
        collection_id: collectionId ?? undefined,
        tags,
      };
      await createResearchItem(body);
      trackSavedTags(tags);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // stay idle on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void handleSave()}
      disabled={loading || !title.trim()}
    >
      {saved ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {saved ? "Saved" : label}
    </Button>
  );
}
