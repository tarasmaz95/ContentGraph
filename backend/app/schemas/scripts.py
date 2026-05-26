"""Pydantic schemas for AI Script Intelligence."""

from pydantic import BaseModel, Field

from app.schemas.hooks import HookPatternRead


class ScriptStructure(BaseModel):
    """Full script outline — opening through closing."""

    opening_hook: str = ""
    intro: str = ""
    key_points: list[str] = Field(default_factory=list)
    transitions: list[str] = Field(default_factory=list)
    cta: str = ""
    closing: str = ""
    full_script: str = ""


class ScriptAnalytics(BaseModel):
    """
    Explainable quality scores (0–100) for a generated script.

    Computed from hook match, creator vocabulary overlap, and readability heuristics.
    """

    estimated_engagement: float = 0.0
    hook_strength: float = 0.0
    emotional_triggers: list[str] = Field(default_factory=list)
    creator_similarity: float = 0.0
    readability: float = 0.0
    notes: str = ""


class ScriptGenerateRequest(BaseModel):
    """User inputs for creator-aware script generation."""

    creator_name: str = Field(..., min_length=1)
    topic: str = Field(..., min_length=2)
    tone: str = "conversational"
    duration: str = "10 minutes"
    hook_type: str = "curiosity"


class ScriptGenerateResult(BaseModel):
    """Complete generated script + analytics + hooks used."""

    creator_name: str
    topic: str
    tone: str
    duration: str
    hook_type: str
    selected_hook: str = ""
    structure: ScriptStructure = Field(default_factory=ScriptStructure)
    analytics: ScriptAnalytics = Field(default_factory=ScriptAnalytics)
    viral_hooks_used: list[str] = Field(default_factory=list)
    style_notes: str = ""


class ScriptAnalyzeRequest(BaseModel):
    """Analyze script text or creator transcript style."""

    creator_name: str = ""
    script_text: str = ""
    topic: str = ""


class ScriptAnalyzeResult(BaseModel):
    """Analysis of a script or creator speaking style."""

    creator_name: str = ""
    summary: str = ""
    structure_detected: ScriptStructure = Field(default_factory=ScriptStructure)
    analytics: ScriptAnalytics = Field(default_factory=ScriptAnalytics)
    recommendations: list[str] = Field(default_factory=list)


class ScriptCompareRequest(BaseModel):
    """Compare generated script vs creator baseline."""

    creator_name: str
    generated_script: str
    topic: str = ""


class ScriptCompareResult(BaseModel):
    """Generated vs creator style / top videos."""

    summary: str = ""
    style_alignment: str = ""
    hook_alignment: str = ""
    gaps: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    top_video_references: list[str] = Field(default_factory=list)


class CreatorStyleContext(BaseModel):
    """Creator DNA for /scripts workspace — hooks, patterns, vocabulary."""

    creator_name: str
    content_style: str = ""
    communication_style: str = ""
    top_topics: list[str] = Field(default_factory=list)
    hook_patterns: list[str] = Field(default_factory=list)
    vocabulary: list[str] = Field(default_factory=list)
    sample_titles: list[str] = Field(default_factory=list)
    transcript_excerpts: list[str] = Field(default_factory=list)


class ScriptWorkspace(BaseModel):
    """GET /scripts/workspace — page context before generation."""

    creators: list[str] = Field(default_factory=list)
    default_structure: ScriptStructure = Field(default_factory=ScriptStructure)
    viral_hooks: list[HookPatternRead] = Field(default_factory=list)
    creator_style: CreatorStyleContext | None = None
    structure_template_notes: str = ""


class ScriptGenerationIntel(BaseModel):
    """LangGraph structured output for script_generation."""

    topic: str = ""
    creator_name: str = ""
    selected_hook: str = ""
    structure: ScriptStructure = Field(default_factory=ScriptStructure)
    analytics: ScriptAnalytics = Field(default_factory=ScriptAnalytics)
    style_notes: str = ""
    recommendations: list[str] = Field(default_factory=list)


class ScriptAnalysisIntel(BaseModel):
    """LangGraph structured output for script_analysis."""

    summary: str = ""
    analytics: ScriptAnalytics = Field(default_factory=ScriptAnalytics)
    recommendations: list[str] = Field(default_factory=list)
    structure_notes: str = ""
