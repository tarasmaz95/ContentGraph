"""
Script Intelligence Service — creator-aware script generation and analysis.

Uses creator profiles, hook_patterns, transcripts, and viral titles — not generic templates.
"""

import re
from collections import Counter

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.schemas.hooks import HookPatternRead
from app.schemas.scripts import (
    CreatorStyleContext,
    ScriptAnalytics,
    ScriptAnalyzeRequest,
    ScriptAnalyzeResult,
    ScriptCompareRequest,
    ScriptCompareResult,
    ScriptGenerateRequest,
    ScriptGenerateResult,
    ScriptStructure,
    ScriptWorkspace,
)
from app.services.creator_intelligence.creator_page_service import CreatorPageService
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.services.hooks.hook_types import HOOK_TYPE_LABELS


class _ScriptLLMOutput(BaseModel):
    """Structured script sections from OpenAI."""

    opening_hook: str = ""
    intro: str = ""
    key_points: list[str] = Field(default_factory=list)
    transitions: list[str] = Field(default_factory=list)
    cta: str = ""
    closing: str = ""
    selected_hook: str = ""
    style_notes: str = ""


class ScriptIntelligenceService:
    """Creator-aware script generation, analysis, and comparison."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._profiles = CreatorProfileService(db)
        self._page = CreatorPageService(db)

    async def get_workspace(self, creator_name: str | None = None) -> ScriptWorkspace:
        """Page context: creators list, viral hooks, optional creator style."""
        creators = await self._profiles.list_creators()
        names = [c.creator_name for c in creators]

        viral: list[HookPatternRead] = []
        style: CreatorStyleContext | None = None

        if creator_name:
            resolved = await self._page.resolve_creator_name(creator_name)
            if resolved:
                ctx = await self._build_creator_context(resolved)
                style = ctx
                viral = [
                    self._hook_to_read(h)
                    for h in await self._top_hooks_for_creator(resolved, limit=12)
                ]

        if not viral:
            viral = [
                self._hook_to_read(h) for h in await self._top_hooks_global(limit=12)
            ]

        template = ScriptStructure(
            opening_hook="[Viral hook — curiosity / identity / transformation]",
            intro="Context + promise — match creator tone",
            key_points=["Point 1", "Point 2", "Point 3"],
            transitions=["Bridge to next idea using creator phrasing"],
            cta="Subscribe / next video / resource",
            closing="Memorable takeaway aligned with creator style",
        )

        return ScriptWorkspace(
            creators=names,
            default_structure=template,
            viral_hooks=viral,
            creator_style=style,
            structure_template_notes=(
                "Scripts follow: Hook → Intro → Key Points → Transitions → CTA → Closing. "
                "Hooks and vocabulary are pulled from indexed creator data."
            ),
        )

    async def generate(
        self,
        llm: ChatOpenAI,
        body: ScriptGenerateRequest,
    ) -> ScriptGenerateResult:
        """
        Generate a full creator-aware script.

        Flow: load creator context → pick viral hook → LLM structured sections → score analytics.
        """
        resolved = await self._page.resolve_creator_name(body.creator_name)
        if not resolved:
            raise ValueError(f"Creator not found: {body.creator_name}")

        ctx = await self._build_creator_context(resolved)
        hooks = await self._top_hooks_for_creator(resolved, hook_type=body.hook_type, limit=8)
        hook_lines = [h.hook_text[:120] for h in hooks[:5]]

        # Auto-select best hook for topic if available
        selected_hook = hook_lines[0] if hook_lines else f"{body.topic} — {body.hook_type} angle"

        context_block = self._format_context_block(ctx, hook_lines, body.topic)

        structured_llm = llm.with_structured_output(_ScriptLLMOutput)
        llm_out: _ScriptLLMOutput = await structured_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You write YouTube video scripts in a specific creator's voice. "
                        "Use ONLY the creator patterns, hooks, transcripts, and titles provided. "
                        "Do not write generic influencer scripts. "
                        f"Target duration: {body.duration}. Tone: {body.tone}. "
                        f"Hook type to emphasize: {body.hook_type} "
                        f"({HOOK_TYPE_LABELS.get(body.hook_type, body.hook_type)}). "
                        "Include 3-5 key points, 2-3 transitions, a clear CTA, and a strong closing."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Creator: {resolved}\n"
                        f"Topic: {body.topic}\n\n"
                        f"Creator intelligence:\n{context_block}\n\n"
                        f"Suggested opening hook: {selected_hook}\n"
                        "Write the script sections in the creator's style."
                    )
                ),
            ]
        )

        structure = self._assemble_structure(llm_out, body.duration)
        analytics = self._score_script(
            structure,
            ctx,
            body.hook_type,
            llm_out.selected_hook or selected_hook,
        )

        return ScriptGenerateResult(
            creator_name=resolved,
            topic=body.topic,
            tone=body.tone,
            duration=body.duration,
            hook_type=body.hook_type,
            selected_hook=llm_out.selected_hook or selected_hook,
            structure=structure,
            analytics=analytics,
            viral_hooks_used=hook_lines,
            style_notes=llm_out.style_notes,
        )

    async def analyze(
        self,
        llm: ChatOpenAI,
        body: ScriptAnalyzeRequest,
    ) -> ScriptAnalyzeResult:
        """Analyze user script text or creator transcript speaking style."""
        ctx_block = ""
        resolved = ""
        if body.creator_name:
            resolved = await self._page.resolve_creator_name(body.creator_name) or ""
            if resolved:
                ctx = await self._build_creator_context(resolved)
                ctx_block = self._format_context_block(ctx, [], body.topic)

        script_text = body.script_text.strip()
        if not script_text and resolved:
            videos = await self._profiles.get_videos_for_creator(resolved, limit=5)
            excerpts = []
            for v in videos:
                row = await self._db.get(Video, v.id)
                if row and row.transcript:
                    excerpts.append(row.transcript[:800])
            script_text = "\n\n".join(excerpts) if excerpts else ""

        class _AnalyzeOut(BaseModel):
            summary: str = ""
            opening_hook: str = ""
            intro: str = ""
            key_points: list[str] = Field(default_factory=list)
            recommendations: list[str] = Field(default_factory=list)

        out: _AnalyzeOut = await llm.with_structured_output(_AnalyzeOut).ainvoke(
            [
                SystemMessage(
                    content="You analyze YouTube scripts for structure, hooks, and creator alignment."
                ),
                HumanMessage(
                    content=(
                        f"Creator context:\n{ctx_block or 'N/A'}\n\n"
                        f"Script/transcript to analyze:\n{script_text[:6000]}\n\n"
                        "Identify structure and give actionable recommendations."
                    )
                ),
            ]
        )

        structure = ScriptStructure(
            opening_hook=out.opening_hook,
            intro=out.intro,
            key_points=out.key_points,
            full_script=script_text[:4000],
        )
        fake_ctx = CreatorStyleContext(creator_name=resolved or "Unknown")
        analytics = self._score_script(structure, fake_ctx, "curiosity", out.opening_hook)

        return ScriptAnalyzeResult(
            creator_name=resolved,
            summary=out.summary,
            structure_detected=structure,
            analytics=analytics,
            recommendations=out.recommendations,
        )

    async def compare(
        self,
        llm: ChatOpenAI,
        body: ScriptCompareRequest,
    ) -> ScriptCompareResult:
        """Compare generated script vs creator style and top videos."""
        resolved = await self._page.resolve_creator_name(body.creator_name)
        if not resolved:
            raise ValueError(f"Creator not found: {body.creator_name}")

        ctx = await self._build_creator_context(resolved)
        videos = await self._profiles.get_videos_for_creator(resolved, limit=8)
        top_titles = [v.title for v in videos[:5]]

        class _CompareOut(BaseModel):
            summary: str = ""
            style_alignment: str = ""
            hook_alignment: str = ""
            gaps: list[str] = Field(default_factory=list)
            strengths: list[str] = Field(default_factory=list)

        out: _CompareOut = await llm.with_structured_output(_CompareOut).ainvoke(
            [
                SystemMessage(
                    content=(
                        "Compare a generated YouTube script against a creator's real content style."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Creator: {resolved}\n"
                        f"Style: {ctx.content_style}\n"
                        f"Communication: {ctx.communication_style}\n"
                        f"Hook patterns: {', '.join(ctx.hook_patterns[:8])}\n"
                        f"Top titles: {top_titles}\n"
                        f"Topic: {body.topic}\n\n"
                        f"Generated script:\n{body.generated_script[:5000]}"
                    )
                ),
            ]
        )

        return ScriptCompareResult(
            summary=out.summary,
            style_alignment=out.style_alignment,
            hook_alignment=out.hook_alignment,
            gaps=out.gaps,
            strengths=out.strengths,
            top_video_references=top_titles[:5],
        )

    async def _build_creator_context(self, creator_name: str) -> CreatorStyleContext:
        """Aggregate profile, hooks, titles, transcript leads for generation."""
        profile = await self._profiles.get_profile(creator_name)
        videos = await self._profiles.get_videos_for_creator(creator_name, limit=20)

        vocabulary: Counter[str] = Counter()
        excerpts: list[str] = []
        titles: list[str] = []

        stop = {
            "the", "a", "an", "to", "in", "on", "for", "of", "and", "or", "is", "it",
            "you", "your", "with", "this", "that", "from", "at", "by", "how", "what",
        }

        for v in videos[:15]:
            titles.append(v.title)
            for word in re.findall(r"[a-z']+", v.title.lower()):
                if len(word) > 4 and word not in stop:
                    vocabulary[word] += 1
            if v.transcript_preview:
                excerpts.append(v.transcript_preview[:350])

        # Full transcript samples from DB for top 3 videos
        for v in sorted(videos, key=lambda x: x.views_count, reverse=True)[:3]:
            row = await self._db.get(Video, v.id)
            if row and row.transcript:
                excerpts.append(row.transcript[:500])

        hooks = await self._top_hooks_for_creator(creator_name, limit=10)
        hook_patterns = list({h.hook_type for h in hooks})

        return CreatorStyleContext(
            creator_name=creator_name,
            content_style=profile.content_style if profile else "",
            communication_style=profile.communication_style if profile else "",
            top_topics=list(profile.top_topics[:8]) if profile else [],
            hook_patterns=hook_patterns,
            vocabulary=[w for w, _ in vocabulary.most_common(20)],
            sample_titles=titles[:10],
            transcript_excerpts=excerpts[:6],
        )

    async def _top_hooks_for_creator(
        self,
        creator_name: str,
        hook_type: str | None = None,
        limit: int = 10,
    ) -> list[HookPattern]:
        stmt = select(HookPattern).where(
            HookPattern.creator_name.ilike(f"%{creator_name}%")
        )
        if hook_type:
            stmt = stmt.where(HookPattern.hook_type == hook_type)
        stmt = stmt.order_by(HookPattern.effectiveness_score.desc()).limit(limit)
        return list((await self._db.execute(stmt)).scalars().all())

    async def _top_hooks_global(self, limit: int) -> list[HookPattern]:
        stmt = (
            select(HookPattern)
            .order_by(HookPattern.effectiveness_score.desc())
            .limit(limit)
        )
        return list((await self._db.execute(stmt)).scalars().all())

    @staticmethod
    def _format_context_block(
        ctx: CreatorStyleContext,
        hook_lines: list[str],
        topic: str,
    ) -> str:
        """Compact prompt block for LLM — creator DNA."""
        parts = [
            f"Content style: {ctx.content_style}",
            f"Communication: {ctx.communication_style}",
            f"Topics: {', '.join(ctx.top_topics)}",
            f"Vocabulary: {', '.join(ctx.vocabulary[:15])}",
            f"Hook patterns: {', '.join(ctx.hook_patterns)}",
            "Sample titles:",
            *[f"  - {t}" for t in ctx.sample_titles[:6]],
            "Transcript voice samples:",
            *[f"  «{e[:200]}…»" for e in ctx.transcript_excerpts[:4]],
            f"Target topic: {topic}",
        ]
        if hook_lines:
            parts.append("Top-performing hooks:")
            parts.extend(f"  - {h}" for h in hook_lines)
        return "\n".join(parts)

    @staticmethod
    def _assemble_structure(llm_out: _ScriptLLMOutput, duration: str) -> ScriptStructure:
        """Merge LLM sections into full_script markdown."""
        sections = [
            ("OPENING HOOK", llm_out.opening_hook),
            ("INTRO", llm_out.intro),
            *[(f"KEY POINT {i + 1}", p) for i, p in enumerate(llm_out.key_points)],
            *[(f"TRANSITION {i + 1}", t) for i, t in enumerate(llm_out.transitions)],
            ("CTA", llm_out.cta),
            ("CLOSING", llm_out.closing),
        ]
        full = f"# Script ({duration})\n\n"
        for label, text in sections:
            if text:
                full += f"## {label}\n{text}\n\n"

        return ScriptStructure(
            opening_hook=llm_out.opening_hook,
            intro=llm_out.intro,
            key_points=llm_out.key_points,
            transitions=llm_out.transitions,
            cta=llm_out.cta,
            closing=llm_out.closing,
            full_script=full.strip(),
        )

    @staticmethod
    def _score_script(
        structure: ScriptStructure,
        ctx: CreatorStyleContext,
        hook_type: str,
        selected_hook: str,
    ) -> ScriptAnalytics:
        """
        Explainable heuristic scores — no extra LLM call.

        Engagement: hook presence + key point count
        Hook strength: keyword overlap with selected hook type
        Creator similarity: vocabulary overlap with creator word list
        Readability: sentence length proxy
        """
        text = structure.full_script or " ".join(
            [structure.opening_hook, structure.intro] + structure.key_points
        )
        words = set(re.findall(r"[a-z']+", text.lower()))
        creator_words = set(ctx.vocabulary)
        overlap = len(words & creator_words) / max(len(creator_words), 1)

        sentences = [s for s in re.split(r"[.!?]+", text) if len(s.strip()) > 10]
        avg_len = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
        readability = max(0, min(100, 100 - (avg_len - 15) * 3))

        hook_lower = (selected_hook + hook_type).lower()
        hook_strength = 40.0
        if structure.opening_hook:
            hook_words = set(re.findall(r"[a-z']+", structure.opening_hook.lower()))
            hook_strength = min(100, 50 + len(hook_words & words) * 8)
        if hook_type in hook_lower or hook_type in text.lower():
            hook_strength = min(100, hook_strength + 15)

        emotional = [
            w
            for w in ("transform", "identity", "secret", "never", "why", "how", "you")
            if w in text.lower()
        ]

        engagement = min(
            100,
            30
            + len(structure.key_points) * 10
            + (25 if structure.cta else 0)
            + (20 if structure.opening_hook else 0),
        )

        return ScriptAnalytics(
            estimated_engagement=round(engagement, 1),
            hook_strength=round(hook_strength, 1),
            emotional_triggers=emotional[:8],
            creator_similarity=round(min(100, overlap * 120), 1),
            readability=round(readability, 1),
            notes=(
                f"Scored against {ctx.creator_name or 'baseline'} vocabulary "
                f"({len(creator_words)} signature words)."
            ),
        )

    @staticmethod
    def _hook_to_read(row: HookPattern) -> HookPatternRead:
        return HookPatternRead(
            id=row.id,
            video_id=row.video_id,
            hook_text=row.hook_text,
            hook_type=row.hook_type,
            creator_name=row.creator_name,
            views_count=row.views_count,
            video_title=row.video_title,
            effectiveness_score=row.effectiveness_score,
            confidence_score=row.confidence_score,
            keywords=list(row.keywords or []),
            emotional_triggers=list(row.emotional_triggers or []),
            created_at=row.created_at,
        )
