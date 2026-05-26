"use client";

import { CopyButton } from "@/components/convenience/copy-button";
import { cn } from "@/lib/utils";

export function CopyCodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/40", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
        <CopyButton text={code} label="" variant="ghost" size="sm" />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground">
        {code}
      </pre>
    </div>
  );
}
