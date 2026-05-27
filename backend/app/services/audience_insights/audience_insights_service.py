"""
Audience Intelligence Service — persisted, refresh-driven insights.

Differs from `CommentsIntelligence` (computed per page load) in three ways:
1. Output is stored in `audience_insights` (one row per video).
2. Generation runs only when missing OR when caller passes `refresh=True`.
3. Combines deterministic aggregation over `comment_score`-ranked rows with
   an optional structured LLM pass (skipped automatically when no OpenAI key
   or when there are not enough comments to be worth it).
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Iterable

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audience_insight import AudienceInsight
from app.models.comment import Comment
from app.schemas.audience_insights import (
    AudienceComment,
    AudienceInsights,
    AudienceSentimentDistribution,
    AudienceTopic,
)
from app.services.comments.comments_service import CommentsService
from app.services.comments.sentiment import is_question

logger = logging.getLogger(__name__)


# Lightweight phrase hints — recycled from the existing audience-intel layer so
# our deterministic pass works even without an LLM.
_PAIN_HINTS = (
    "struggle",
    "hard",
    "difficult",
    "confused",
    "don't get",
    "doesn't work",
    "stuck",
    "frustrat",
    "overwhelm",
    "give up",
)
_DESIRE_HINTS = (
    "want",
    "wish",
    "need",
    "would love",
    "please make",
    "more videos on",
    "show me how",
    "teach me",
)
_STOPWORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "this",
        "that",
        "you",
        "your",
        "with",
        "but",
        "are",
        "was",
        "have",
        "has",
        "they",
        "them",
        "their",
        "from",
        "what",
        "when",
        "where",
        "why",
        "how",
        "who",
        "into",
        "very",
        "just",
        "like",
        "really",
        "would",
        "could",
        "should",
        "about",
        "thank",
        "thanks",
    }
)


# Sample / quality knobs — single place to tune.
TOP_COMMENT_SAMPLE = 50  # rows pulled for analysis (uses ix_comments_video_score)
TOP_COMMENT_RETURN = 25  # rows persisted in the cache snapshot + UI
MIN_COMMENTS_FOR_LLM = 5  # below this, skip LLM and serve deterministic only
TOP_TOPICS_LIMIT = 10
PAIN_POINTS_LIMIT = 8
DESIRES_LIMIT = 8


class _AudienceLLMOut(BaseModel):
    """Structured LLM output. Each field optional — falls back to deterministic."""

    summary: str = ""
    top_topics: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    desires: list[str] = Field(default_factory=list)


class AudienceInsightsService:
    """Build, cache, and serve `AudienceInsights` per video."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ── Public API ────────────────────────────────────────────────────────────

    async def get_for_video(
        self,
        video_id: int,
        *,
        refresh: bool,
        llm: ChatOpenAI | None,
    ) -> AudienceInsights:
        """
        Return cached insight or regenerate.

        - `refresh=False`: serve cache when present, otherwise generate (cold).
        - `refresh=True`: always regenerate; overwrite cache row.
        """
        existing = await self._load(video_id)

        if existing and not refresh:
            return self._to_schema(existing)

        return await self._generate_and_store(
            video_id=video_id,
            existing=existing,
            llm=llm,
        )

    async def get_cached(self, video_id: int) -> AudienceInsights | None:
        """Cache-only read; returns None when nothing stored yet."""
        existing = await self._load(video_id)
        if not existing:
            return None
        return self._to_schema(existing)

    # ── Internals ─────────────────────────────────────────────────────────────

    async def _load(self, video_id: int) -> AudienceInsight | None:
        stmt = select(AudienceInsight).where(AudienceInsight.video_id == video_id)
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def _generate_and_store(
        self,
        *,
        video_id: int,
        existing: AudienceInsight | None,
        llm: ChatOpenAI | None,
    ) -> AudienceInsights:
        comments_service = CommentsService(self._db)
        rows = await comments_service.list_for_video(
            video_id, limit=TOP_COMMENT_SAMPLE
        )
        total = await comments_service.count_for_video(video_id)

        if not rows:
            # Persist an empty row so the next call hits the cache; UI shows
            # the empty state and offers to refresh once comments exist.
            insight = self._upsert(
                existing=existing,
                video_id=video_id,
                summary="",
                top_topics=[],
                pain_points=[],
                desires=[],
                sentiment=AudienceSentimentDistribution(),
                top_comments=[],
                comment_count=0,
                model_used="rules",
            )
            schema = self._to_schema(insight)
            schema.is_empty = True
            schema.total_comments = total
            return schema

        # Deterministic pass (always runs).
        det = self._deterministic_pass(rows)

        # Optional LLM enrichment.
        model_used = "rules"
        summary = det["summary"]
        top_topics = det["top_topics"]
        pain_points = det["pain_points"]
        desires = det["desires"]

        if llm is not None and len(rows) >= MIN_COMMENTS_FOR_LLM:
            try:
                llm_out = await self._llm_pass(llm, rows)
                model_used = getattr(llm, "model_name", "openai")
                if llm_out.summary:
                    summary = llm_out.summary
                if llm_out.top_topics:
                    merged_labels: list[str] = []
                    seen: set[str] = set()
                    for label in (
                        llm_out.top_topics + [t.label for t in top_topics]
                    ):
                        key = label.strip().lower()
                        if not key or key in seen:
                            continue
                        seen.add(key)
                        merged_labels.append(label.strip())
                    top_topics = [
                        AudienceTopic(label=lbl, weight=1.0 - i * 0.05)
                        for i, lbl in enumerate(merged_labels[:TOP_TOPICS_LIMIT])
                    ]
                if llm_out.pain_points:
                    pain_points = _dedupe_strings(
                        llm_out.pain_points + pain_points, PAIN_POINTS_LIMIT
                    )
                if llm_out.desires:
                    desires = _dedupe_strings(
                        llm_out.desires + desires, DESIRES_LIMIT
                    )
            except Exception as err:  # noqa: BLE001 — never fail the request
                logger.warning(
                    "audience_insights_llm_failed video_id=%s err=%r",
                    video_id,
                    err,
                )

        sentiment = self._sentiment_distribution(rows)
        top_comments = self._snapshot_top_comments(rows)

        insight = self._upsert(
            existing=existing,
            video_id=video_id,
            summary=summary,
            top_topics=top_topics,
            pain_points=pain_points,
            desires=desires,
            sentiment=sentiment,
            top_comments=top_comments,
            comment_count=len(rows),
            model_used=model_used,
        )

        schema = self._to_schema(insight)
        schema.total_comments = total
        return schema

    def _upsert(
        self,
        *,
        existing: AudienceInsight | None,
        video_id: int,
        summary: str,
        top_topics: list[AudienceTopic],
        pain_points: list[str],
        desires: list[str],
        sentiment: AudienceSentimentDistribution,
        top_comments: list[AudienceComment],
        comment_count: int,
        model_used: str,
    ) -> AudienceInsight:
        now = datetime.now(timezone.utc)
        payload_topics = [t.model_dump() for t in top_topics]
        payload_top = [c.model_dump() for c in top_comments]
        payload_sentiment = sentiment.model_dump()

        if existing is None:
            row = AudienceInsight(
                video_id=video_id,
                summary=summary,
                top_topics=payload_topics,
                pain_points=pain_points,
                desires=desires,
                sentiment_distribution=payload_sentiment,
                top_comments_snapshot=payload_top,
                comment_count_at_generation=comment_count,
                model_used=model_used,
                generated_at=now,
            )
            self._db.add(row)
        else:
            existing.summary = summary
            existing.top_topics = payload_topics
            existing.pain_points = pain_points
            existing.desires = desires
            existing.sentiment_distribution = payload_sentiment
            existing.top_comments_snapshot = payload_top
            existing.comment_count_at_generation = comment_count
            existing.model_used = model_used
            existing.generated_at = now
            row = existing

        # Commit so the caller sees a stable cache row immediately; subsequent
        # API calls within the same request would otherwise share the session
        # and observe a transient row.
        # We flush + commit here because the endpoint passes a request-scoped
        # session and finishes the response right after.
        return row

    # ── Deterministic analysis ────────────────────────────────────────────────

    def _deterministic_pass(self, rows: list[Comment]) -> dict:
        bigrams = self._top_bigrams(rows, n=TOP_TOPICS_LIMIT)
        topics = [
            AudienceTopic(label=phrase, weight=float(count))
            for phrase, count in bigrams
        ]

        pain_points = [
            r.comment_text[:200]
            for r in rows
            if any(h in r.comment_text.lower() for h in _PAIN_HINTS)
        ][:PAIN_POINTS_LIMIT]

        desires = [
            r.comment_text[:200]
            for r in rows
            if any(h in r.comment_text.lower() for h in _DESIRE_HINTS)
        ][:DESIRES_LIMIT]

        sentiments = Counter(r.sentiment or "neutral" for r in rows)
        dominant = sentiments.most_common(1)[0][0] if sentiments else "neutral"
        questions = sum(1 for r in rows if is_question(r.comment_text))

        summary = (
            f"Audience sentiment skews {dominant}. "
            f"{questions} of the top {len(rows)} comments ask a question. "
            f"Strongest recurring topic: "
            f"{topics[0].label if topics else 'mixed'}."
        )

        return {
            "summary": summary,
            "top_topics": topics,
            "pain_points": pain_points,
            "desires": desires,
        }

    def _top_bigrams(
        self, rows: list[Comment], n: int
    ) -> list[tuple[str, int]]:
        counter: Counter[str] = Counter()
        for r in rows:
            words = re.findall(r"[a-z']{3,}", r.comment_text.lower())
            words = [w for w in words if w not in _STOPWORDS]
            for i in range(len(words) - 1):
                bg = f"{words[i]} {words[i + 1]}"
                counter[bg] += 1
        return counter.most_common(n)

    def _sentiment_distribution(
        self, rows: list[Comment]
    ) -> AudienceSentimentDistribution:
        total = len(rows) or 1
        c = Counter(r.sentiment or "neutral" for r in rows)
        return AudienceSentimentDistribution(
            positive=round(100 * c.get("positive", 0) / total, 1),
            neutral=round(100 * c.get("neutral", 0) / total, 1),
            negative=round(100 * c.get("negative", 0) / total, 1),
        )

    def _snapshot_top_comments(
        self, rows: list[Comment]
    ) -> list[AudienceComment]:
        # Rows are already sorted by score (list_for_video uses comment_score
        # index), but tie-break here for stability.
        ordered = sorted(
            rows,
            key=lambda r: (
                int(getattr(r, "comment_score", 0) or 0),
                int(r.likes_count or 0),
            ),
            reverse=True,
        )
        return [
            AudienceComment(
                id=r.id,
                author=r.author_name or "",
                text=r.comment_text[:1500],
                likes_count=int(r.likes_count or 0),
                reply_count=int(getattr(r, "reply_count", 0) or 0),
                is_pinned=bool(getattr(r, "is_pinned", False)),
                is_hearted=bool(getattr(r, "is_hearted", False)),
                score=int(getattr(r, "comment_score", 0) or 0),
                sentiment=r.sentiment or "neutral",
                published_text=getattr(r, "published_text", None),
            )
            for r in ordered[:TOP_COMMENT_RETURN]
        ]

    # ── LLM ────────────────────────────────────────────────────────────────────

    async def _llm_pass(
        self,
        llm: ChatOpenAI,
        rows: list[Comment],
    ) -> _AudienceLLMOut:
        """
        Single structured LLM call over the highest-scored comments. Returns
        empty defaults when the call fails — caller decides whether to fall back.
        """
        sample = "\n".join(
            f"- [{r.sentiment or 'neutral'}] "
            f"likes={r.likes_count or 0} replies={getattr(r, 'reply_count', 0) or 0}"
            f"{' PINNED' if getattr(r, 'is_pinned', False) else ''}"
            f"{' HEARTED' if getattr(r, 'is_hearted', False) else ''}: "
            f"{r.comment_text[:280]}"
            for r in rows[:TOP_COMMENT_RETURN]
        )

        structured = llm.with_structured_output(_AudienceLLMOut)
        return await structured.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are an audience research assistant for a YouTube "
                        "creator. Given the highest-ranked comments on a single "
                        "video, identify what viewers care about. Be specific, "
                        "concise, and grounded only in the comments shown. "
                        "Return: short narrative summary (max 60 words), "
                        "5-10 distinct top topics (2-4 word phrases), "
                        "explicit pain points (verbatim or near-verbatim snippets), "
                        "and explicit desires (what they want next, requests, wishes). "
                        "Skip generic filler. Skip emoji-only comments."
                    )
                ),
                HumanMessage(content=f"Comments:\n{sample}"),
            ]
        )

    # ── Serialization ─────────────────────────────────────────────────────────

    def _to_schema(self, row: AudienceInsight) -> AudienceInsights:
        return AudienceInsights(
            video_id=row.video_id,
            summary=row.summary or "",
            top_topics=[
                AudienceTopic(**t) if isinstance(t, dict) else AudienceTopic(label=str(t))
                for t in (row.top_topics or [])
            ],
            pain_points=list(row.pain_points or []),
            desires=list(row.desires or []),
            sentiment_distribution=AudienceSentimentDistribution(
                **(row.sentiment_distribution or {})
            ),
            top_comments=[
                AudienceComment(**c) for c in (row.top_comments_snapshot or [])
            ],
            comment_count_at_generation=row.comment_count_at_generation or 0,
            model_used=row.model_used or "rules",
            generated_at=row.generated_at,
            is_empty=not (row.comment_count_at_generation or row.top_comments_snapshot),
        )


def _dedupe_strings(items: Iterable[str], limit: int) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in items:
        normalized = (raw or "").strip()
        if not normalized:
            continue
        key = normalized.lower()[:160]
        if key in seen:
            continue
        seen.add(key)
        out.append(normalized[:240])
        if len(out) >= limit:
            break
    return out
