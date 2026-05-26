"use client";

import type { FeedSectionData } from "@/lib/feed-curate";
import { FeedInsightCard } from "@/components/feed/feed-card";
import { useT } from "@/lib/i18n";

interface FeedSectionProps {
  section: FeedSectionData;
}

export function FeedSection({ section }: FeedSectionProps) {
  const t = useT();
  const title = t(`feed.sections.${section.id}.title`);
  const description = t(`feed.sections.${section.id}.description`);

  if (section.insights.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4" aria-labelledby={`feed-section-${section.id}`}>
      <div className="space-y-1">
        <h3
          id={`feed-section-${section.id}`}
          className="text-sm font-semibold tracking-wide text-foreground"
        >
          {title}
        </h3>
        <p className="text-xs text-muted-foreground max-w-xl">{description}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {section.insights.map((insight) => (
          <li key={insight.id}>
            <FeedInsightCard insight={insight} />
          </li>
        ))}
      </ul>
    </section>
  );
}
