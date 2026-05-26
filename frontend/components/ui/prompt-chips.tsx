"use client";

import { MessageSquare, Search, Sparkles } from "lucide-react";

import type { ExamplePrompt } from "@/lib/prompts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptChipsProps {
  prompts: ExamplePrompt[];
  onSelect: (prompt: ExamplePrompt) => void;
  disabled?: boolean;
  className?: string;
}

const ACTION_ICON = {
  chat: MessageSquare,
  search: Search,
  semantic: Sparkles,
} as const;

/** Clickable example prompts — used across pages and chat */
export function PromptChips({
  prompts,
  onSelect,
  disabled,
  className,
}: PromptChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {prompts.map((p) => {
        const Icon = ACTION_ICON[p.action];
        return (
          <Button
            key={p.text}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto max-w-full whitespace-normal py-2 text-left text-xs font-normal"
            onClick={() => onSelect(p)}
            disabled={disabled}
          >
            <Icon className="mr-1.5 h-3 w-3 shrink-0 text-primary" />
            {p.label}
          </Button>
        );
      })}
    </div>
  );
}
