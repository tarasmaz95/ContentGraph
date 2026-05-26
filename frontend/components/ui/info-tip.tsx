"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { getGlossaryTerm, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface InfoTipProps {
  term: string;
  className?: string;
}

/** Lightweight "What is this?" — no heavy tooltip library */
export function InfoTip({ term, className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const text = getGlossaryTerm(locale, term);

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        className="rounded-full p-0.5 text-muted-foreground hover:text-primary"
        aria-label="Explain"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-card p-2 text-left text-xs font-normal shadow-md"
        >
          {text}
        </span>
      )}
    </span>
  );
}
