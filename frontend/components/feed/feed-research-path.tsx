"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { ResearchPathStep } from "@/lib/feed-briefing";
import { useT } from "@/lib/i18n";

interface FeedResearchPathProps {
  steps: ResearchPathStep[];
}

export function FeedResearchPath({ steps }: FeedResearchPathProps) {
  const t = useT();

  if (steps.length === 0) {
    return null;
  }

  return (
    <nav aria-labelledby="feed-research-path-title" className="sm:pl-6">
      <h3
        id="feed-research-path-title"
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80"
      >
        {t("feed.researchPath.title")}
      </h3>
      <ol className="mt-4 space-y-0">
        {steps.map((step, index) => (
          <li key={step.order} className="relative flex gap-4 pb-1 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                className="absolute left-[11px] top-7 bottom-0 w-px bg-border/60"
                aria-hidden
              />
            ) : null}
            <span
              className="relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-[11px] font-medium tabular-nums text-muted-foreground"
              aria-hidden
            >
              {step.order}
            </span>
            <div className="min-w-0 flex-1 pb-5 pt-0.5">
              {step.href ? (
                <Link
                  href={step.href}
                  className="group inline-flex max-w-full items-start gap-1 text-sm font-medium leading-snug text-foreground/90 hover:text-primary"
                >
                  <span className="line-clamp-2">{step.label}</span>
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                </Link>
              ) : (
                <span className="text-sm font-medium leading-snug text-foreground/90">
                  {step.label}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
