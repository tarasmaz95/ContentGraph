"""Research workspace API — insights, notes, search, export."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.research import (
    ExportMarkdown,
    ResearchCollectionCreate,
    ResearchCollectionRead,
    ResearchItemCreate,
    ResearchItemRead,
    ResearchItemUpdate,
    ResearchNoteCreate,
    ResearchNoteRead,
    ResearchNoteUpdate,
    ResearchSearchResult,
    ResearchSummary,
    ResearchWorkspace,
    SavedInsightCreate,
    SavedInsightRead,
)
from app.services.research.research_service import ResearchService

router = APIRouter(prefix="/research", tags=["research"])


@router.get("/workspace", response_model=ResearchWorkspace)
async def get_workspace(db: AsyncSession = Depends(get_db)) -> ResearchWorkspace:
    """Full research page: insights, notes, creator findings, comparisons."""
    return await ResearchService(db).get_workspace()


@router.get("/summary", response_model=ResearchSummary)
async def get_summary(db: AsyncSession = Depends(get_db)) -> ResearchSummary:
    """Dashboard widgets — recent insights and notes."""
    return await ResearchService(db).get_summary()


@router.get("/search", response_model=list[ResearchSearchResult])
async def search_research(
    q: str = Query(..., min_length=1),
    limit: int = Query(40, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[ResearchSearchResult]:
    """Search notes, insights, creators (via text), and tags."""
    return await ResearchService(db).search(q, limit=limit)


@router.get("/export/markdown", response_model=ExportMarkdown)
async def export_markdown(db: AsyncSession = Depends(get_db)) -> ExportMarkdown:
    """Export all research as markdown."""
    return await ResearchService(db).export_markdown()


# --- Collections ---

@router.get("/collections", response_model=list[ResearchCollectionRead])
async def list_collections(db: AsyncSession = Depends(get_db)) -> list[ResearchCollectionRead]:
    return await ResearchService(db).list_collections()


@router.post("/collections", response_model=ResearchCollectionRead)
async def create_collection(
    body: ResearchCollectionCreate,
    db: AsyncSession = Depends(get_db),
) -> ResearchCollectionRead:
    return await ResearchService(db).create_collection(body)


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    ok = await ResearchService(db).delete_collection(collection_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"deleted": True}


# --- Research items (snapshots) ---

@router.get("/items", response_model=list[ResearchItemRead])
async def list_research_items(
    collection_id: int | None = Query(None),
    type: str | None = Query(None, alias="type"),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[ResearchItemRead]:
    return await ResearchService(db).list_items(
        collection_id=collection_id,
        item_type=type,
        limit=limit,
    )


@router.get("/items/{item_id}", response_model=ResearchItemRead)
async def get_research_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
) -> ResearchItemRead:
    item = await ResearchService(db).get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Research item not found")
    return item


@router.post("/items", response_model=ResearchItemRead)
async def create_research_item(
    body: ResearchItemCreate,
    db: AsyncSession = Depends(get_db),
) -> ResearchItemRead:
    try:
        return await ResearchService(db).create_item(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/items/{item_id}", response_model=ResearchItemRead)
async def update_research_item(
    item_id: int,
    body: ResearchItemUpdate,
    db: AsyncSession = Depends(get_db),
) -> ResearchItemRead:
    try:
        item = await ResearchService(db).update_item(item_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if item is None:
        raise HTTPException(status_code=404, detail="Research item not found")
    return item


@router.delete("/items/{item_id}")
async def delete_research_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    ok = await ResearchService(db).delete_item(item_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Research item not found")
    return {"deleted": True}


# --- Insights ---

@router.get("/insights", response_model=list[SavedInsightRead])
async def list_insights(db: AsyncSession = Depends(get_db)) -> list[SavedInsightRead]:
    return await ResearchService(db).list_insights()


@router.post("/insights", response_model=SavedInsightRead)
async def save_insight(
    body: SavedInsightCreate,
    db: AsyncSession = Depends(get_db),
) -> SavedInsightRead:
    return await ResearchService(db).create_insight(body)


@router.delete("/insights/{insight_id}")
async def delete_insight(
    insight_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    ok = await ResearchService(db).delete_insight(insight_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Insight not found")
    return {"deleted": True}


# --- Notes ---

@router.get("/notes", response_model=list[ResearchNoteRead])
async def list_notes(db: AsyncSession = Depends(get_db)) -> list[ResearchNoteRead]:
    return await ResearchService(db).list_notes()


@router.post("/notes", response_model=ResearchNoteRead)
async def create_note(
    body: ResearchNoteCreate,
    db: AsyncSession = Depends(get_db),
) -> ResearchNoteRead:
    return await ResearchService(db).create_note(body)


@router.patch("/notes/{note_id}", response_model=ResearchNoteRead)
async def update_note(
    note_id: int,
    body: ResearchNoteUpdate,
    db: AsyncSession = Depends(get_db),
) -> ResearchNoteRead:
    note = await ResearchService(db).update_note(note_id, body)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    ok = await ResearchService(db).delete_note(note_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"deleted": True}
