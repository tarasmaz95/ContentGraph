"use client";

import { useState } from "react";
import { Pin, PinOff } from "lucide-react";

import { notifyPinsUpdated } from "@/components/convenience/pinned-creators-bar";
import {
  isPinnedCreator,
  togglePinnedCreator,
} from "@/lib/convenience-storage";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function PinCreatorButton({ creatorName }: { creatorName: string }) {
  const t = useT();
  const [pinned, setPinned] = useState(() => isPinnedCreator(creatorName));

  const toggle = () => {
    const next = togglePinnedCreator(creatorName);
    setPinned(next.some((p) => p.toLowerCase() === creatorName.toLowerCase()));
    notifyPinsUpdated();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      title={pinned ? t("convenience.unpin") : t("convenience.pin")}
      className="gap-1"
    >
      {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      {pinned ? t("convenience.unpin") : t("convenience.pin")}
    </Button>
  );
}
