"""
Audience Intelligence — analyze stored comments for creator insights.

Deterministic aggregation + optional LLM summary on refresh.
"""

from __future__ import annotations

import re
from collections import Counter

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.schemas.comments import CommentCharts, CommentRead, CommentsIntelligence
from app.schemas.common import ChartPoint
from app.services.comments.comments_service import CommentsService
from app.services.comments.sentiment import is_question


class _AudienceLLM(BaseModel):
    """LLM pass for narrative audience insights."""

    recurring_reactions: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    emotional_triggers: list[str] = Field(default_factory=list)
    audience_desires: list[str] = Field(default_factory=list)
    confusion_points: list[str] = Field(default_factory=list)
    repeated_questions: list[str] = Field(default_factory=list)
    summary: str = ""


# Phrase hints for pain / desire detection (lightweight rules)
PAIN_HINTS = ("struggle", "hard", "difficult", "confused", "don't get", "doesn't work", "stuck")
DESIRE_HINTS = ("want", "wish", "need", "would love", "please make", "more videos on")


class AudienceIntelligenceService:
    """Build CommentsIntelligence for video pages and LangGraph."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._comments = CommentsService(db)

    async def build_for_video(
        self,
        video_id: int,
        llm: ChatOpenAI | None = None,
        refresh: bool = False,
    ) -> CommentsIntelligence:
        """Aggregate comments + charts; optional LLM enrichment."""
        rows = await self._comments.list_for_video(video_id)
        if not rows:
            return CommentsIntelligence()

        intel = self._aggregate(rows)

        if llm and refresh and len(rows) >= 3:
            llm_out = await self._llm_analyze(llm, rows)
            intel.audience_reactions = llm_out.recurring_reactions or intel.audience_reactions
            intel.pain_points = llm_out.pain_points or intel.pain_points
            intel.emotional_patterns = llm_out.emotional_triggers or intel.emotional_patterns
            intel.audience_desires = llm_out.audience_desires or intel.audience_desires
            intel.confusion_points = llm_out.confusion_points or intel.confusion_points
            intel.questions = llm_out.repeated_questions or intel.questions
            intel.summary = llm_out.summary

        return intel

    async def ensure_comments(self, video) -> int:
        """Return stored comment count (extension ingest or manual API fetch)."""
        return await self._comments.count_for_video(video.id)

    def _aggregate(self, rows: list[Comment]) -> CommentsIntelligence:
        """Deterministic audience metrics from stored comments."""
        top = [
            CommentRead(
                id=r.id,
                video_id=r.video_id,
                comment_text=r.comment_text,
                author_name=r.author_name or "",
                likes_count=r.likes_count or 0,
                published_at=r.published_at,
                sentiment=r.sentiment or "neutral",
                emotional_tags=list(r.emotional_tags or []),
            )
            for r in rows[:25]
        ]

        sentiments = Counter(r.sentiment or "neutral" for r in rows)
        total = len(rows)
        pos_pct = round(100 * sentiments.get("positive", 0) / total, 1)
        neg_pct = round(100 * sentiments.get("negative", 0) / total, 1)
        neu_pct = round(100 * sentiments.get("neutral", 0) / total, 1)

        tag_counts: Counter[str] = Counter()
        for r in rows:
            for tag in r.emotional_tags or []:
                tag_counts[tag] += 1

        questions = [r.comment_text[:200] for r in rows if is_question(r.comment_text)]
        pain_points = [
            r.comment_text[:180]
            for r in rows
            if any(h in r.comment_text.lower() for h in PAIN_HINTS)
        ][:8]
        desires = [
            r.comment_text[:180]
            for r in rows
            if any(h in r.comment_text.lower() for h in DESIRE_HINTS)
        ][:8]
        confusion = [
            r.comment_text[:180]
            for r in rows
            if "confusion" in (r.emotional_tags or [])
            or "confus" in r.comment_text.lower()
        ][:8]

        phrase_pairs = self._top_recurring_phrases(rows, n=10)
        reactions = [p for p, _ in phrase_pairs[:6]]
        phrases = phrase_pairs

        charts = CommentCharts(
            sentiment_distribution=[
                ChartPoint(label=k, count=v, value=round(100 * v / total, 1))
                for k, v in sentiments.items()
            ],
            emotional_triggers=[
                ChartPoint(label=tag, count=cnt, value=cnt)
                for tag, cnt in tag_counts.most_common(8)
            ],
            question_frequency=[
                ChartPoint(label=f"Q{i + 1}", count=1, value=1)
                for i in range(min(8, len(questions)))
            ],
            recurring_phrases=[
                ChartPoint(label=p, count=c, value=c)
                for p, c in phrases[:8]
            ],
        )

        return CommentsIntelligence(
            total_comments=total,
            top_comments=top,
            audience_reactions=reactions,
            emotional_patterns=[t for t, _ in tag_counts.most_common(6)],
            questions=questions[:10],
            pain_points=pain_points,
            audience_desires=desires,
            confusion_points=confusion,
            recurring_phrases=[p for p, _ in phrases[:10]],
            positive_pct=pos_pct,
            negative_pct=neg_pct,
            neutral_pct=neu_pct,
            charts=charts,
            summary=self._deterministic_summary(sentiments, tag_counts, len(questions)),
        )

    async def _llm_analyze(self, llm: ChatOpenAI, rows: list[Comment]) -> _AudienceLLM:
        """One structured LLM call over top comment texts."""
        sample = "\n".join(
            f"- [{r.sentiment}] {r.comment_text[:300]}"
            for r in sorted(rows, key=lambda x: x.likes_count or 0, reverse=True)[:20]
        )
        structured = llm.with_structured_output(_AudienceLLM)
        return await structured.ainvoke(
            [
                SystemMessage(
                    content=(
                        "Analyze YouTube comments for creator-focused audience intelligence. "
                        "Extract recurring reactions, pain points, desires, confusion, and questions."
                    )
                ),
                HumanMessage(content=f"Comments:\n{sample}"),
            ]
        )

    def _top_recurring_phrases(
        self, rows: list[Comment], n: int = 8
    ) -> list[tuple[str, int]]:
        """Bigram frequency — surfaces repeated audience language."""
        bigrams: Counter[str] = Counter()
        for r in rows:
            words = re.findall(r"[a-z']{3,}", r.comment_text.lower())
            for i in range(len(words) - 1):
                bg = f"{words[i]} {words[i + 1]}"
                if words[i] in {"the", "and", "for", "this", "that", "you"}:
                    continue
                bigrams[bg] += 1
        return bigrams.most_common(n)

    @staticmethod
    def _deterministic_summary(
        sentiments: Counter[str],
        tags: Counter[str],
        question_count: int,
    ) -> str:
        dominant = sentiments.most_common(1)[0][0] if sentiments else "neutral"
        top_tag = tags.most_common(1)[0][0] if tags else "mixed"
        return (
            f"Audience sentiment skews {dominant}; "
            f"strongest emotional signal: {top_tag}; "
            f"{question_count} question-style comments."
        )
