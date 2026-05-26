"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";

import { trackSavedTags } from "@/lib/personalization";
import { saveInsight } from "@/services/api";
import type { SavedInsightCreate } from "@/types/research";
import { Button } from "@/components/ui/button";

interface SaveInsightButtonProps {
  insightText: string;
  sourceType: string;
  sourceReference?: string;
  tags?: string[];
  label?: string;
  variant?: "default" | "outline" | "secondary";
}

/**
 * One-click save to research workspace — used in Chat and Creator pages.
 */
export function SaveInsightButton({
  insightText,
  sourceType,
  sourceReference = "",
  tags = [],
  label = "Save Insight",
  variant = "outline",
}: SaveInsightButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!insightText.trim() || loading) return;
    setLoading(true);
    try {
      const body: SavedInsightCreate = {
        insight_text: insightText.trim(),
        source_type: sourceType,
        source_reference: sourceReference,
        tags,
      };
      await saveInsight(body);
      trackSavedTags(tags);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // minimal UX — button stays idle on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => void handleSave()}
      disabled={loading || !insightText.trim()}
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
