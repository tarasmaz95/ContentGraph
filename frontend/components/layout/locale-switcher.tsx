"use client";

import { Languages } from "lucide-react";

import { useLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Toggle EN / UK in the header */
export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();

  const options: { code: Locale; label: string }[] = [
    { code: "en", label: "EN" },
    { code: "uk", label: "UA" },
  ];

  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-md border bg-background p-0.5"
      role="group"
      aria-label={t("locale.switch")}
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {options.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => setLocale(opt.code)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition-colors",
            locale === opt.code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          title={t(`locale.${opt.code}`)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
