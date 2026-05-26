"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CompareSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  primary?: boolean;
}

/** Lightweight section wrapper — spacing over bordered cards. */
export function CompareSection({
  title,
  description,
  children,
  className,
  primary = false,
}: CompareSectionProps) {
  return (
    <section
      className={cn(
        primary ? "pb-2" : "border-t border-border/40 pt-12",
        className,
      )}
    >
      <header className="mb-6">
        <h3
          className={cn(
            "font-semibold tracking-tight text-foreground",
            primary ? "text-lg" : "text-base",
          )}
        >
          {title}
        </h3>
        {description ? (
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
