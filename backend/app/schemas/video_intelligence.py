"""Schemas for Video Intelligence pages and LangGraph."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.comments import CommentsIntelligence
from app.schemas.common import ChartPoint, KeywordStat
from app.schemas.video import VideoDetail


class VideoOverview(BaseModel):
    """Header card on /videos/[id]."""

    id: int
    title: str
    creator_name: str
    channel_url: str
    views_count: int
    subscribers_count: int
    published_at: datetime | None = None
    has_transcript: bool = False
    hook_types: list[str] = Field(default_factory=list)
    primary_hook_type: str = ""
    semantic_score: float | None = None
    performance_tier: str = ""  # viral | strong | average
    has_comments: bool = False
    comment_count: int = 0


class KeyMoment(BaseModel):
    """Timestamp-free segment highlight from transcript."""

    label: str
    excerpt: str
    start_pct: float = 0.0  # position in transcript 0–100


class TranscriptIntelligence(BaseModel):
    """Transcript-derived insights — deterministic + LLM highlights."""

    preview: str = ""
    full_available: bool = False
    key_moments: list[KeyMoment] = Field(default_factory=list)
    strongest_insights: list[str] = Field(default_factory=list)
    repeated_themes: list[str] = Field(default_factory=list)
    cta_sections: list[str] = Field(default_factory=list)
    emotional_phrases: list[str] = Field(default_factory=list)


class StructureSection(BaseModel):
    """One block in video structure timeline."""

    section: str
    summary: str
    start_pct: float = 0.0
    end_pct: float = 0.0


class StructureAnalysis(BaseModel):
    """Hook → intro → sections → CTA → closing."""

    hook: str = ""
    intro: str = ""
    key_sections: list[StructureSection] = Field(default_factory=list)
    transitions: list[str] = Field(default_factory=list)
    cta: str = ""
    closing: str = ""


class VideoBreakdown(BaseModel):
    """AI performance breakdown for one video."""

    why_performed: str = ""
    hook_effectiveness: str = ""
    emotional_triggers: list[str] = Field(default_factory=list)
    storytelling_patterns: list[str] = Field(default_factory=list)
    pacing: str = ""
    communication_style: str = ""
    cta_patterns: list[str] = Field(default_factory=list)
    audience_targeting: str = ""
    recommendations: list[str] = Field(default_factory=list)


class ViralAnalysis(BaseModel):
    """Viral factors and reusable frameworks."""

    viral_factors: list[str] = Field(default_factory=list)
    reusable_frameworks: list[str] = Field(default_factory=list)
    top_keywords: list[KeywordStat] = Field(default_factory=list)
    emotional_triggers: list[str] = Field(default_factory=list)
    creator_patterns: list[str] = Field(default_factory=list)


class SimilarVideoItem(BaseModel):
    """Semantically related video."""

    id: int
    title: str
    creator_name: str
    views_count: int
    similarity_score: float = 0.0
    match_source: str | None = None
    shared_hook_type: str | None = None


class VideoCharts(BaseModel):
    """Recharts data for video page."""

    topic_frequency: list[ChartPoint] = Field(default_factory=list)
    emotional_distribution: list[ChartPoint] = Field(default_factory=list)
    structure_timeline: list[ChartPoint] = Field(default_factory=list)
    keyword_frequency: list[ChartPoint] = Field(default_factory=list)


class AudienceIntelMvp(BaseModel):
    """Lightweight audience layer from stored comments (no LLM)."""

    top_reactions: list[str] = Field(default_factory=list)
    repeated_phrases: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    top_comment_preview: str = ""


class VideoIntelligence(BaseModel):
    """Full GET /videos/{id}/intelligence payload."""

    video: VideoDetail
    overview: VideoOverview
    breakdown: VideoBreakdown = Field(default_factory=VideoBreakdown)
    transcript_intel: TranscriptIntelligence = Field(default_factory=TranscriptIntelligence)
    structure: StructureAnalysis = Field(default_factory=StructureAnalysis)
    viral: ViralAnalysis = Field(default_factory=ViralAnalysis)
    similar_videos: list[SimilarVideoItem] = Field(default_factory=list)
    charts: VideoCharts = Field(default_factory=VideoCharts)
    comments: CommentsIntelligence = Field(default_factory=CommentsIntelligence)
    audience_intel: AudienceIntelMvp = Field(default_factory=AudienceIntelMvp)


# --- LangGraph structured outputs ---


class VideoBreakdownIntel(BaseModel):
    """LangGraph video_breakdown."""

    video_id: int = 0
    title: str = ""
    breakdown: VideoBreakdown = Field(default_factory=VideoBreakdown)
    structure: StructureAnalysis = Field(default_factory=StructureAnalysis)


class TranscriptAnalysisIntel(BaseModel):
    """LangGraph transcript_analysis."""

    video_id: int = 0
    transcript_intel: TranscriptIntelligence = Field(default_factory=TranscriptIntelligence)
    recommendations: list[str] = Field(default_factory=list)


class ViralAnalysisIntel(BaseModel):
    """LangGraph viral_analysis."""

    video_id: int = 0
    viral: ViralAnalysis = Field(default_factory=ViralAnalysis)
    summary: str = ""


class AudienceAnalysisIntel(BaseModel):
    """LangGraph audience_analysis."""

    video_id: int = 0
    summary: str = ""
    comments_intel: CommentsIntelligence = Field(default_factory=CommentsIntelligence)
    recommendations: list[str] = Field(default_factory=list)


class CommentsAnalysisIntel(BaseModel):
    """LangGraph comments_analysis."""

    video_id: int = 0
    comments_intel: CommentsIntelligence = Field(default_factory=CommentsIntelligence)
    recommendations: list[str] = Field(default_factory=list)
