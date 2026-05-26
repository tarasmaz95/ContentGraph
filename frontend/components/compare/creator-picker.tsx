"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface CreatorPickerProps {
  label: string;
  creators: string[];
  value: string;
  onChange: (name: string) => void;
  exclude?: string;
}

/** Single searchable combobox — filters the full creator catalog. */
export function CreatorPicker({
  label,
  creators,
  value,
  onChange,
  exclude,
}: CreatorPickerProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setQuery("");
  }, [value, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = creators.filter((c) => {
      if (exclude && c.toLowerCase() === exclude.toLowerCase()) return false;
      if (!q) return true;
      return c.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [creators, query, exclude]);

  const inputValue = open ? query : value;
  const showBrowseHint = open && !query.trim() && filtered.length > 0;

  return (
    <div
      ref={rootRef}
      className={cn("space-y-1.5", open && "relative z-50")}
    >
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder={t("compare.searchCreator")}
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange("");
          }}
          onFocus={() => setOpen(true)}
          className={cn(value && !open && "pr-9")}
        />
        {value && !open ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => onChange("")}
            aria-label={t("compare.clearCreator")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden
          />
        )}
        {open && (
          <div
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg ring-1 ring-black/5"
            role="presentation"
          >
            {showBrowseHint ? (
              <p className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                {t("compare.creatorListHint", { count: filtered.length })}
              </p>
            ) : null}
            {filtered.length > 0 ? (
              <ul
                className="max-h-60 overflow-y-auto py-1"
                role="listbox"
              >
                {filtered.map((name) => (
                  <li key={name} role="option" className="bg-card">
                    <button
                      type="button"
                      className="w-full bg-card px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(name);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                {t("compare.noCreatorMatches")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
