"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, Sparkles } from "lucide-react";

import { useCommandPalette } from "@/components/command-palette/command-palette";
import { PinnedCreatorsBar } from "@/components/convenience/pinned-creators-bar";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NavMoreMenu } from "@/components/layout/nav-more-menu";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();
  const { setOpen } = useCommandPalette();
  const t = useT();

  const PRIMARY = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/feed", label: t("nav.feed") },
    { href: "/creators", label: t("nav.creators") },
    { href: "/compare", label: t("nav.compare") },
    { href: "/research", label: t("nav.research") },
    { href: "/chat", label: t("nav.chat") },
  ];

  const linkClass = (href: string) =>
    cn(
      "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <header className="sticky top-0 z-30 overflow-visible border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-1.5 font-semibold text-primary"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">ContentGraph</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5">
          <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
            {PRIMARY.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>

          <span
            className="mx-1 hidden h-4 w-px shrink-0 bg-border md:block"
            aria-hidden
          />

          <NavMoreMenu />
        </nav>

        <PinnedCreatorsBar />

        <LocaleSwitcher />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          <Command className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("nav.search")}</span>
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
      </div>
    </header>
  );
}
