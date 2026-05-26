"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STEPS = [
  "Routing your question",
  "Retrieving relevant videos",
  "Running structured analysis",
  "Synthesizing insights",
];

/**
 * Staged AI loading — feels responsive even without true streaming.
 */
export function AiThinking() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4 animate-in fade-in duration-300">
      <ul className="space-y-2">
        {STEPS.map((label, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2 text-sm transition-opacity",
                i > stepIndex && "opacity-40",
              )}
            >
              {done ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <span className="h-4 w-4 rounded-full border" />
              )}
              <span className={active ? "font-medium text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}
