import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Hide section when empty — pass false to skip render */
  show?: boolean;
}

/** Grouped content block — reduces visual noise on dense pages */
export function Section({
  title,
  description,
  children,
  className,
  show = true,
}: SectionProps) {
  if (!show) return null;

  return (
    <section className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
