"use client";

import type { ResearchSectionData } from "@/lib/feed-briefing";
import { FeedInsightBlock } from "@/components/feed/feed-insight-block";
import { useT } from "@/lib/i18n";

interface FeedResearchSectionProps {
  section: ResearchSectionData;
  isFirst?: boolean;
}

export function FeedResearchSection({
  section,
  isFirst = false,
}: FeedResearchSectionProps) {
  const t = useT();
  const title = t(`feed.researchSections.${section.id}.title`);
  const description = t(`feed.researchSections.${section.id}.description`);

  if (section.insights.length === 0) {
    return null;
  }

  return (
    <section
      className={isFirst ? "pt-0" : "border-t border-border/40 pt-12"}
      aria-labelledby={`feed-research-${section.id}`}
    >
      <header className="mb-6 sm:pl-6">
        <h3
          id={`feed-research-${section.id}`}
          className="text-base font-semibold tracking-tight text-foreground"
        >
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      <ul className="divide-y divide-border/40 sm:pl-6">
        {section.insights.map((insight) => (
          <li key={insight.id}>
            <FeedInsightBlock insight={insight} />
          </li>
        ))}
      </ul>
    </section>
  );
}
