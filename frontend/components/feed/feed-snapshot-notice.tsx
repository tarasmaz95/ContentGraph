"use client";

import { useT } from "@/lib/i18n";

interface FeedSnapshotNoticeProps {
  hasSnapshotHistory: boolean;
}

export function FeedSnapshotNotice({ hasSnapshotHistory }: FeedSnapshotNoticeProps) {
  const t = useT();

  if (hasSnapshotHistory) {
    return null;
  }

  return (
    <p
      role="status"
      className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-muted-foreground leading-relaxed"
    >
      {t("feed.snapshotNotice")}
    </p>
  );
}
