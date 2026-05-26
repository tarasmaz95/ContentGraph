"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitCompare } from "lucide-react";

import {
  compareUrl,
  getLastComparePartner,
  getPinnedCreators,
  setLastComparePartner,
} from "@/lib/convenience-storage";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface QuickCompareProps {
  currentCreator: string;
  variant?: "link" | "menu";
}

/** 1-click compare with last partner or pinned creators. */
export function QuickCompare({ currentCreator, variant = "link" }: QuickCompareProps) {
  const t = useT();
  const [last, setLast] = useState<string | null>(null);
  const [pins, setPins] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLast(getLastComparePartner());
    setPins(
      getPinnedCreators().filter(
        (p) => p.toLowerCase() !== currentCreator.toLowerCase(),
      ),
    );
  }, [currentCreator]);

  const rememberAndGo = (other: string) => {
    setLastComparePartner(other);
    window.location.href = compareUrl(currentCreator, other);
  };

  if (variant === "link" && last && last.toLowerCase() !== currentCreator.toLowerCase()) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={compareUrl(currentCreator, last)}
          onClick={() => setLastComparePartner(last)}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
        >
          <GitCompare className="h-4 w-4" />
          {t("convenience.compareWithLast", { name: last })}
        </Link>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {t("convenience.moreCompare")}
        </Button>
        {open && (
          <ComparePicker
            current={currentCreator}
            options={[...pins]}
            onPick={rememberAndGo}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <GitCompare className="h-4 w-4" />
        {t("creators.compareWith")}
      </Button>
      {open && (
        <ComparePicker
          current={currentCreator}
          options={pins.length ? pins : [last].filter(Boolean) as string[]}
          onPick={(name) => {
            rememberAndGo(name);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ComparePicker({
  current,
  options,
  onPick,
}: {
  current: string;
  options: string[];
  onPick: (name: string) => void;
}) {
  const t = useT();
  const unique = [...new Set(options)].filter(
    (n) => n && n.toLowerCase() !== current.toLowerCase(),
  );

  if (!unique.length) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">{t("convenience.pinCreatorsHint")}</p>
    );
  }

  return (
    <ul className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-md border bg-card py-1 shadow-md">
      {unique.map((name) => (
        <li key={name}>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => onPick(name)}
          >
            {t("convenience.compareWithLast", { name })}
          </button>
        </li>
      ))}
    </ul>
  );
}
