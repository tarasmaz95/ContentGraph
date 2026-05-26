"""Pydantic schemas for research workspace API."""

from datetime import datetime

from pydantic import BaseModel, Field


class SavedInsightCreate(BaseModel):
    insight_text: str = Field(..., min_length=1, max_length=8000)
    source_type: str = Field(..., description="chat | creator_profile | creator_comparison | analytics")
    source_reference: str = ""
    tags: list[str] = Field(default_factory=list)


class SavedInsightRead(BaseModel):
    id: int
    insight_text: str
    source_type: str
    source_reference: str
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ResearchNoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    type: str = "general"
    creator_name: str | None = None
    tags: list[str] = Field(default_factory=list)


class ResearchNoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    type: str | None = None
    creator_name: str | None = None
    tags: list[str] | None = None


class ResearchNoteRead(BaseModel):
    id: int
    title: str
    content: str
    type: str
    creator_name: str | None
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ResearchSearchResult(BaseModel):
    """Unified search hit across insights, notes, and items."""

    kind: str  # insight | note | item
    id: int
    title: str
    snippet: str
    creator_name: str | None = None
    tags: list[str] = Field(default_factory=list)
    source_type: str | None = None


class ResearchSummary(BaseModel):
    """Dashboard widget: recent research activity."""

    recent_insights: list[SavedInsightRead]
    creator_findings: list[SavedInsightRead]
    saved_comparisons: list[SavedInsightRead]
    recent_notes: list[ResearchNoteRead]
    total_insights: int
    total_notes: int


class ResearchCollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ResearchCollectionRead(BaseModel):
    id: int
    name: str
    created_at: datetime
    item_count: int = 0

    model_config = {"from_attributes": True}


class ResearchItemCreate(BaseModel):
    type: str = Field(
        ...,
        description="creator_compare | creator_snapshot | hook | breakout_video | "
        "audience_insight | semantic_theme | feed_signal",
    )
    title: str = Field(..., min_length=1, max_length=512)
    payload_json: dict = Field(default_factory=dict)
    collection_id: int | None = None
    notes: str = ""
    tags: list[str] = Field(default_factory=list)


class ResearchItemUpdate(BaseModel):
    collection_id: int | None = None
    notes: str | None = None
    tags: list[str] | None = None


class ResearchItemRead(BaseModel):
    id: int
    collection_id: int | None
    type: str
    title: str
    payload_json: dict
    notes: str
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ResearchWorkspace(BaseModel):
    """Full /research page payload."""

    insights: list[SavedInsightRead]
    notes: list[ResearchNoteRead]
    creator_findings: list[SavedInsightRead]
    comparisons: list[SavedInsightRead]
    collections: list[ResearchCollectionRead] = Field(default_factory=list)
    items: list[ResearchItemRead] = Field(default_factory=list)
    timeline: list[ResearchItemRead] = Field(default_factory=list)


class ExportMarkdown(BaseModel):
    markdown: str
