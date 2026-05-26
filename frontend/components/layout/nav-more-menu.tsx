"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ChevronDown,
  FileText,
  FileUp,
  Laptop,
  Puzzle,
  Settings,
  Zap,
} from "lucide-react";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface NavMoreItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** Secondary nav — click dropdown, closes on outside click / Esc */
export function NavMoreMenu() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items: NavMoreItem[] = [
    { href: "/intelligence/health", label: t("nav.intelligenceHealth"), icon: Activity },
    { href: "/analytics", label: t("nav.analytics"), icon: BarChart3 },
    { href: "/hooks", label: t("nav.hooks"), icon: Zap },
    { href: "/scripts", label: t("nav.scripts"), icon: FileText },
    { href: "/transcripts/api-ingestion", label: t("nav.transcriptApiIngestion"), icon: FileUp },
    { href: "/browser-ingestion", label: t("nav.browserIngestion"), icon: Laptop },
    { href: "/extension", label: t("nav.extension"), icon: Puzzle },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  const isActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-40 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {t("nav.more")}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute left-0 top-full z-[100] mt-1 min-w-[11rem] rounded-md border bg-card py-1 shadow-lg animate-in"
        >
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href} role="none">
                <Link
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
