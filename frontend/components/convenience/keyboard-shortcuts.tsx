"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useCommandPalette } from "@/components/command-palette/command-palette";

const SEMANTIC_INPUT_ID = "cg-semantic-search-input";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Global shortcuts — no external library. */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { open, setOpen } = useCommandPalette();
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearG = () => {
      pendingG.current = false;
      if (gTimer.current) clearTimeout(gTimer.current);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") return;

      if (e.key === "Escape") {
        setOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        clearG();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        if (pathname !== "/dashboard") {
          router.push("/dashboard");
          setTimeout(() => focusSemanticInput(), 120);
        } else {
          focusSemanticInput();
        }
        return;
      }

      if (e.key === "s") {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (e.key === "c") {
        e.preventDefault();
        router.push("/compare");
        return;
      }

      if (e.key === "g") {
        e.preventDefault();
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(clearG, 1200);
        return;
      }

      if (pendingG.current) {
        e.preventDefault();
        clearG();
        const routes: Record<string, string> = {
          c: "/creators",
          f: "/feed",
          d: "/dashboard",
          r: "/research",
          h: "/hooks",
        };
        const href = routes[e.key];
        if (href) router.push(href);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearG();
    };
  }, [pathname, router, setOpen, open]);

  return null;
}

function focusSemanticInput() {
  const el = document.getElementById(SEMANTIC_INPUT_ID);
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.select();
  }
}

export { SEMANTIC_INPUT_ID };
