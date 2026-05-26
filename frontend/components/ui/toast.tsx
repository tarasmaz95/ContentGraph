"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error";

export interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
  durationMs?: number;
}

/** Lightweight toast — no external dependency. */
export function Toast({
  message,
  variant,
  onDismiss,
  durationMs = 4000,
}: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onDismiss]);

  const Icon = variant === "success" ? CheckCircle2 : XCircle;

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 shadow-lg",
        variant === "success"
          ? "border-emerald-500/30 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
