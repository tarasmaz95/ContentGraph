"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Flame,
  Heart,
  Loader2,
  MessageSquareWarning,
  Pin,
  RefreshCw,
  Reply,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAudienceInsights } from "@/services/api";
import type {
  AudienceComment,
  AudienceInsights,
} from "@/types/audience-insights";

interface Props {
  videoId: number;
}

/**
 * Audience Intelligence — persisted, refresh-driven AI layer.
 *
 * Cache-first read on mount; users explicitly click "Generate" / "Refresh" to
 * rebuild. Empty state CTA when no comments are saved yet.
 */
export function AudienceIntelligenceSection({ videoId }: Props) {
  const [data, setData] = useState<AudienceInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!videoId || Number.isNaN(videoId)) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const fresh = await fetchAudienceInsights(videoId, refresh);
        setData(fresh);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Не вдалося завантажити аудиторію",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [videoId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Аудиторна інтелігенція
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Завантаження…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Аудиторна інтелігенція
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void load(true)}
          >
            Спробувати ще раз
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Empty state — no comments saved yet OR generation skipped.
  if (data.is_empty || data.total_comments === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Аудиторна інтелігенція
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Для цього відео ще немає збережених коментарів. Запустіть browser
            ingestion або YouTube API fetch — після цього натисніть{" "}
            <span className="font-medium">Generate</span>, щоб отримати AI
            розбір.
          </p>
          <Button
            className="mt-3"
            variant="default"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Згенерувати
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { sentiment_distribution: sent } = data;
  const generatedAt = data.generated_at
    ? new Date(data.generated_at).toLocaleString()
    : "—";

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Brain className="h-5 w-5 text-primary" />
            Аудиторна інтелігенція
          </h2>
          <p className="text-xs text-muted-foreground">
            Згенеровано {generatedAt} · модель{" "}
            <span className="font-mono">{data.model_used}</span> · аналіз по{" "}
            {data.comment_count_at_generation} топ-коментарях (всього{" "}
            {data.total_comments})
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Оновити AI
        </Button>
      </header>

      {data.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-резюме
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90">
              {data.summary}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              Топ-теми
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.top_topics.map((t) => (
                  <span
                    key={t.label}
                    className="rounded-full border bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                    title={`weight ${t.weight.toFixed(2)}`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquareWarning className="h-4 w-4 text-red-600" />
              Pain points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.pain_points.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data.pain_points.map((p, i) => (
                  <li key={i} className="text-foreground/80">
                    • {p}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-emerald-600" />
              Бажання / запити
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.desires.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data.desires.map((d, i) => (
                  <li key={i} className="text-foreground/80">
                    • {d}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Розподіл настроїв</CardTitle>
        </CardHeader>
        <CardContent>
          <SentimentBar
            positive={sent.positive}
            neutral={sent.neutral}
            negative={sent.negative}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
              Позитивні {sent.positive}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-slate-400" />
              Нейтральні {sent.neutral}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-500" />
              Негативні {sent.negative}%
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            Найвпливовіші коментарі ({data.top_comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.top_comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Немає коментарів у топі.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.top_comments.map((c, i) => (
                <ViralCommentRow key={c.id ?? `${i}-${c.author}`} c={c} rank={i + 1} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SentimentBar({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const total = Math.max(positive + neutral + negative, 1);
  const pos = (positive / total) * 100;
  const neu = (neutral / total) * 100;
  const neg = (negative / total) * 100;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="bg-emerald-500 transition-all"
        style={{ width: `${pos}%` }}
        title={`Позитивні ${positive}%`}
      />
      <div
        className="bg-slate-400 transition-all"
        style={{ width: `${neu}%` }}
        title={`Нейтральні ${neutral}%`}
      />
      <div
        className="bg-red-500 transition-all"
        style={{ width: `${neg}%` }}
        title={`Негативні ${negative}%`}
      />
    </div>
  );
}

function ViralCommentRow({ c, rank }: { c: AudienceComment; rank: number }) {
  return (
    <li className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
          #{rank}
        </span>
        <span className="font-medium">{c.author || "Anonymous"}</span>
        {c.is_pinned && (
          <span
            className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800"
            title="Закріплений креатором"
          >
            <Pin className="h-3 w-3" />
            Pinned
          </span>
        )}
        {c.is_hearted && (
          <span
            className="flex items-center gap-1 rounded bg-pink-100 px-1.5 py-0.5 text-xs font-medium text-pink-800"
            title="Сердечко від креатора"
          >
            <Heart className="h-3 w-3" />
          </span>
        )}
        <span
          className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800"
          title="Composite ranking score"
        >
          score {c.score.toLocaleString()}
        </span>
        {c.published_text && (
          <span className="text-xs text-muted-foreground">
            {c.published_text}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {c.reply_count > 0 && (
            <span className="flex items-center gap-1" title="Replies">
              <Reply className="h-3 w-3" />
              {c.reply_count.toLocaleString()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {c.likes_count.toLocaleString()}
          </span>
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground/90">
        {c.text}
      </p>
    </li>
  );
}
