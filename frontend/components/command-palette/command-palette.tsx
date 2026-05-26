"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Laptop,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  Puzzle,
  Search,
  Settings,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { getAllExamplePrompts, useLocale, useT } from "@/lib/i18n";
import { searchVideos } from "@/services/api";
import { trackSearch } from "@/lib/personalization";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import type { Video } from "@/types/video";
import { cn } from "@/lib/utils";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette requires CommandPaletteProvider");
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
      {open && <CommandPaletteDialog onClose={() => setOpen(false)} />}
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = useDebouncedCallback(async (q: string) => {
    if (q.length < 2) {
      setVideos([]);
      return;
    }
    setSearching(true);
    try {
      setVideos(await searchVideos(q));
    } catch {
      setVideos([]);
    } finally {
      setSearching(false);
    }
  }, 280);

  useEffect(() => {
    runSearch(query.trim());
  }, [query, runSearch]);

  const prompts = useMemo(() => {
    const q = query.toLowerCase();
    return getAllExamplePrompts(locale).filter(
      (p) =>
        !q ||
        p.label.toLowerCase().includes(q) ||
        p.text.toLowerCase().includes(q),
    );
  }, [query, locale]);

  const navFiltered = useMemo(() => {
    const q = query.toLowerCase();
    const navItems = [
      { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard, keys: "sync videos" },
      {
        label: t("nav.settings"),
        href: "/settings",
        icon: Settings,
        keys: "google sheets spreadsheet range env data source",
      },
      { label: t("home.intelligenceFeed"), href: "/feed", icon: Newspaper, keys: "trends" },
      { label: t("nav.creators"), href: "/creators", icon: Users, keys: "profiles" },
      { label: t("nav.compare"), href: "/compare", icon: Users, keys: "versus compare" },
      { label: t("nav.hooks"), href: "/hooks", icon: Zap, keys: "patterns" },
      { label: t("nav.scripts"), href: "/scripts", icon: FileText, keys: "generate" },
      { label: t("nav.research"), href: "/research", icon: FileText, keys: "save notes" },
      { label: t("nav.extension"), href: "/extension", icon: Puzzle, keys: "chrome transcript" },
      {
        label: t("nav.transcriptApiIngestion"),
        href: "/transcripts/api-ingestion",
        icon: FileText,
        keys: "api ingest batch youtube transcript missing",
      },
      {
        label: t("nav.browserIngestion"),
        href: "/browser-ingestion",
        icon: Laptop,
        keys: "browser worker playwright extension home laptop",
      },
      { label: t("home.copilotChat"), href: "/chat", icon: MessageSquare, keys: "ask ai" },
      { label: t("commandPalette.welcome"), href: "/welcome", icon: Sparkles, keys: "onboarding" },
    ];
    return navItems.filter(
      (n) =>
        !q ||
        n.label.toLowerCase().includes(q) ||
        n.keys.toLowerCase().includes(q),
    );
  }, [query, t]);

  const goChat = (text: string) => {
    trackSearch(text);
    onClose();
    router.push(`/chat?q=${encodeURIComponent(text)}`);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder={t("commandPalette.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] sm:inline">
            {t("commandPalette.esc")}
          </kbd>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {navFiltered.length > 0 && (
            <CommandGroup title={t("commandPalette.goTo")}>
              {navFiltered.map((item) => (
                <CommandRow
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  onSelect={() => {
                    onClose();
                    router.push(item.href);
                  }}
                />
              ))}
            </CommandGroup>
          )}

          {prompts.length > 0 && (
            <CommandGroup title={t("commandPalette.askCopilot")}>
              {prompts.slice(0, 6).map((p) => (
                <CommandRow
                  key={p.text}
                  icon={MessageSquare}
                  label={p.label}
                  hint={p.text}
                  onSelect={() => goChat(p.text)}
                />
              ))}
            </CommandGroup>
          )}

          {searching && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t("commandPalette.searching")}
            </p>
          )}

          {videos.length > 0 && (
            <CommandGroup title={t("common.videos")}>
              {videos.slice(0, 8).map((v) => (
                <CommandRow
                  key={v.id}
                  icon={ArrowRight}
                  label={v.title}
                  hint={t("commandPalette.viewsHint", {
                    creator: v.creator_name,
                    views: v.views_count.toLocaleString(),
                  })}
                  onSelect={() => {
                    onClose();
                    router.push(`/videos/${v.id}`);
                  }}
                />
              ))}
            </CommandGroup>
          )}
        </div>

        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          {t("commandPalette.footer")}{" "}
          <Link href="/welcome" className="text-primary underline" onClick={onClose}>
            {t("home.tutorial")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function CommandGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function CommandRow({
  icon: Icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string | undefined }>;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
          "hover:bg-accent",
        )}
        onClick={onSelect}
      >
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          {hint && (
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
          )}
        </span>
      </button>
    </li>
  );
}
