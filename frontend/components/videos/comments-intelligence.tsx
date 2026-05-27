"use client";

import { useMemo, useState } from "react";
import { Heart, MessageCircle, Pin, Reply, ThumbsUp } from "lucide-react";

import { CommentChartsPanel } from "@/components/videos/comment-charts";
import type { CommentRead, CommentsIntelligence } from "@/types/video-intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

interface CommentsIntelligenceProps {
  data: CommentsIntelligence;
}

type SortMode = "likes" | "newest" | "emotional" | "longest";
type FilterMode = "all" | "positive" | "negative" | "fear" | "ambition";

const SENTIMENT_CLASS: Record<string, string> = {
  positive: "bg-green-100 text-green-800",
  neutral: "bg-slate-100 text-slate-700",
  negative: "bg-red-100 text-red-800",
};

/**
 * Comments Intelligence — top comments with sort/filter for audience review.
 */
export function CommentsIntelligenceSection({ data }: CommentsIntelligenceProps) {
  const t = useT();
  const [sort, setSort] = useState<SortMode>("likes");
  const [filter, setFilter] = useState<FilterMode>("all");

  const displayed = useMemo(
    () => sortAndFilterComments(data.top_comments, sort, filter),
    [data.top_comments, sort, filter],
  );

  if (data.total_comments === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            {t("convenience.commentsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("convenience.commentsEmpty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="h-5 w-5" />
          {t("convenience.commentsTitle")}
        </h2>
        {data.summary && (
          <p className="text-sm text-muted-foreground">{data.summary}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">
            {t("convenience.positive")} {data.positive_pct}%
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
            {t("convenience.neutral")} {data.neutral_pct}%
          </span>
          <span className="rounded-md bg-red-100 px-2 py-1 text-red-800">
            {t("convenience.negative")} {data.negative_pct}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t("convenience.sort")}</span>
        {(["likes", "newest", "emotional", "longest"] as SortMode[]).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={sort === mode ? "default" : "outline"}
            onClick={() => setSort(mode)}
          >
            {t(`convenience.sort_${mode}`)}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t("convenience.filter")}</span>
        {(["all", "positive", "negative", "fear", "ambition"] as FilterMode[]).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={filter === mode ? "secondary" : "ghost"}
            onClick={() => setFilter(mode)}
          >
            {t(`convenience.filter_${mode}`)}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InsightList title={t("convenience.audienceReactions")} items={data.audience_reactions} />
        <InsightList title={t("convenience.emotionalPatterns")} items={data.emotional_patterns} />
        <InsightList title={t("convenience.questions")} items={data.questions} />
        <InsightList title={t("convenience.painPoints")} items={data.pain_points} />
        <InsightList title={t("convenience.audienceDesires")} items={data.audience_desires} />
        <InsightList title={t("convenience.confusionPoints")} items={data.confusion_points} />
      </div>

      <div>
        <h3 className="mb-4 text-base font-semibold">
          {t("convenience.topComments")} ({displayed.length})
        </h3>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("convenience.noCommentsMatch")}</p>
        ) : (
          <ul className="space-y-3">
            {displayed.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border bg-card p-4 text-sm shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.author_name || "Anonymous"}</span>
                  {c.is_pinned && (
                    <span
                      className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800"
                      title="Pinned by creator"
                    >
                      <Pin className="h-3 w-3" />
                      Pinned
                    </span>
                  )}
                  {c.is_hearted && (
                    <span
                      className="flex items-center gap-1 rounded bg-pink-100 px-1.5 py-0.5 text-xs font-medium text-pink-800"
                      title="Hearted by creator"
                    >
                      <Heart className="h-3 w-3" />
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      SENTIMENT_CLASS[c.sentiment] ?? "bg-muted"
                    }`}
                  >
                    {c.sentiment}
                  </span>
                  {c.emotional_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {c.published_text && (
                    <span className="text-xs text-muted-foreground">{c.published_text}</span>
                  )}
                  <span className="ml-auto flex items-center gap-3 text-muted-foreground">
                    {(c.reply_count ?? 0) > 0 && (
                      <span
                        className="flex items-center gap-1"
                        title={`${c.reply_count} replies`}
                      >
                        <Reply className="h-3 w-3" />
                        {(c.reply_count ?? 0).toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {c.likes_count.toLocaleString()}
                    </span>
                  </span>
                </div>
                <p className="text-foreground/90">{c.comment_text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-base font-semibold">{t("convenience.commentsAnalytics")}</h3>
        <CommentChartsPanel charts={data.charts} />
      </div>
    </section>
  );
}

function sortAndFilterComments(
  comments: CommentRead[],
  sort: SortMode,
  filter: FilterMode,
): CommentRead[] {
  let list = [...comments];

  if (filter === "positive") list = list.filter((c) => c.sentiment === "positive");
  else if (filter === "negative") list = list.filter((c) => c.sentiment === "negative");
  else if (filter === "fear") {
    list = list.filter(
      (c) =>
        /\bfear\b/i.test(c.comment_text) ||
        c.emotional_tags.some((t) => t.includes("skepticism")),
    );
  } else if (filter === "ambition") {
    list = list.filter(
      (c) =>
        c.emotional_tags.some((t) =>
          ["motivation", "inspiration", "excitement"].includes(t),
        ) || /\b(goal|dream|success|ambition|discipline)\b/i.test(c.comment_text),
    );
  }

  switch (sort) {
    case "likes":
      list.sort((a, b) => b.likes_count - a.likes_count);
      break;
    case "newest":
      list.sort((a, b) => {
        const ta = a.published_at ? Date.parse(a.published_at) : 0;
        const tb = b.published_at ? Date.parse(b.published_at) : 0;
        return tb - ta;
      });
      break;
    case "emotional":
      list.sort(
        (a, b) => (b.emotional_tags?.length ?? 0) - (a.emotional_tags?.length ?? 0),
      );
      break;
    case "longest":
      list.sort((a, b) => b.comment_text.length - a.comment_text.length);
      break;
  }

  return list;
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
