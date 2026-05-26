"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pin } from "lucide-react";

import { getPinnedCreators } from "@/lib/convenience-storage";
import { slugifyCreatorName } from "@/lib/creator-slug";

/** Pinned creator quick links in nav */
export function PinnedCreatorsBar() {
  const [pins, setPins] = useState<string[]>([]);

  useEffect(() => {
    setPins(getPinnedCreators());
    const onStorage = () => setPins(getPinnedCreators());
    window.addEventListener("storage", onStorage);
    window.addEventListener("cg-pins-updated", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cg-pins-updated", onStorage);
    };
  }, []);

  if (!pins.length) return null;

  return (
    <div className="hidden items-center gap-1 border-l pl-2 lg:flex">
      <Pin className="h-3 w-3 text-muted-foreground" aria-hidden />
      {pins.slice(0, 5).map((name) => (
        <Link
          key={name}
          href={`/creators/${slugifyCreatorName(name)}`}
          className="whitespace-nowrap rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title={name}
        >
          {name.length > 14 ? `${name.slice(0, 12)}…` : name}
        </Link>
      ))}
    </div>
  );
}

export function notifyPinsUpdated() {
  window.dispatchEvent(new Event("cg-pins-updated"));
}
