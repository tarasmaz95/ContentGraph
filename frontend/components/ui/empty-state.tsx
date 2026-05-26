"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { PromptChips } from "@/components/ui/prompt-chips";
import { useT } from "@/lib/i18n";
import type { ExamplePrompt } from "@/lib/prompts";
import { cn } from "@/lib/utils";

interface EmptyStateLink {
  label: string;
  href: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  prompts?: ExamplePrompt[];
  onPrompt?: (prompt: ExamplePrompt) => void;
  links?: EmptyStateLink[];
  className?: string;
}

/**
 * Unified empty state — explains the page and suggests next actions.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  prompts,
  onPrompt,
  links,
  className,
}: EmptyStateProps) {
  const t = useT();

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {prompts && prompts.length > 0 && onPrompt && (
        <div className="mt-6 w-full max-w-lg">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("common.tryAsking")}
          </p>
          <PromptChips prompts={prompts} onSelect={onPrompt} />
        </div>
      )}

      {links && links.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
