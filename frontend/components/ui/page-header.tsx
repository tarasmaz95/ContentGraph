import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Glossary key for contextual help */
  helpKey?: string;
  actions?: ReactNode;
  className?: string;
  sticky?: boolean;
}

/** Consistent page title block — optional sticky action bar */
export function PageHeader({
  icon: Icon,
  title,
  description,
  helpKey,
  actions,
  className,
  sticky = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        sticky &&
          "sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {Icon && <Icon className="h-7 w-7 shrink-0 text-primary" />}
          <span className="truncate">{title}</span>
          {helpKey && <InfoTip term={helpKey} />}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
