"""Research workspace — insights, notes, search, markdown export."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.research import (
    RESEARCH_ITEM_TYPES,
    ResearchCollection,
    ResearchItem,
    ResearchNote,
    SavedInsight,
)
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


class ResearchService:
    """CRUD and search for lightweight research workflow (single-user, no teams)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # --- Saved insights ---

    async def create_insight(self, data: SavedInsightCreate) -> SavedInsightRead:
        row = SavedInsight(
            insight_text=data.insight_text.strip(),
            source_type=data.source_type,
            source_reference=data.source_reference,
            tags=data.tags,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return SavedInsightRead.model_validate(row)

    async def list_insights(self, limit: int = 100) -> list[SavedInsightRead]:
        stmt = (
            select(SavedInsight)
            .order_by(SavedInsight.created_at.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return [SavedInsightRead.model_validate(r) for r in result.scalars().all()]

    async def delete_insight(self, insight_id: int) -> bool:
        row = await self._db.get(SavedInsight, insight_id)
        if row is None:
            return False
        await self._db.delete(row)
        await self._db.commit()
        return True

    async def insights_by_source(self, source_type: str, limit: int = 50) -> list[SavedInsightRead]:
        stmt = (
            select(SavedInsight)
            .where(SavedInsight.source_type == source_type)
            .order_by(SavedInsight.created_at.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return [SavedInsightRead.model_validate(r) for r in result.scalars().all()]

    # --- Research notes ---

    async def create_note(self, data: ResearchNoteCreate) -> ResearchNoteRead:
        row = ResearchNote(
            title=data.title.strip(),
            content=data.content.strip(),
            type=data.type,
            creator_name=data.creator_name,
            tags=data.tags,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return ResearchNoteRead.model_validate(row)

    async def list_notes(self, limit: int = 100) -> list[ResearchNoteRead]:
        stmt = (
            select(ResearchNote)
            .order_by(ResearchNote.created_at.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return [ResearchNoteRead.model_validate(r) for r in result.scalars().all()]

    async def update_note(
        self,
        note_id: int,
        data: ResearchNoteUpdate,
    ) -> ResearchNoteRead | None:
        row = await self._db.get(ResearchNote, note_id)
        if row is None:
            return None
        if data.title is not None:
            row.title = data.title
        if data.content is not None:
            row.content = data.content
        if data.type is not None:
            row.type = data.type
        if data.creator_name is not None:
            row.creator_name = data.creator_name
        if data.tags is not None:
            row.tags = data.tags
        await self._db.commit()
        await self._db.refresh(row)
        return ResearchNoteRead.model_validate(row)

    async def delete_note(self, note_id: int) -> bool:
        row = await self._db.get(ResearchNote, note_id)
        if row is None:
            return False
        await self._db.delete(row)
        await self._db.commit()
        return True

    # --- Collections ---

    async def create_collection(self, data: ResearchCollectionCreate) -> ResearchCollectionRead:
        row = ResearchCollection(name=data.name.strip())
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return ResearchCollectionRead(id=row.id, name=row.name, created_at=row.created_at, item_count=0)

    async def list_collections(self) -> list[ResearchCollectionRead]:
        counts = dict(
            (await self._db.execute(
                select(ResearchItem.collection_id, func.count())
                .where(ResearchItem.collection_id.isnot(None))
                .group_by(ResearchItem.collection_id)
            )).all()
        )
        rows = list(
            (
                await self._db.execute(
                    select(ResearchCollection).order_by(ResearchCollection.name)
                )
            ).scalars()
        )
        return [
            ResearchCollectionRead(
                id=r.id,
                name=r.name,
                created_at=r.created_at,
                item_count=int(counts.get(r.id, 0)),
            )
            for r in rows
        ]

    async def delete_collection(self, collection_id: int) -> bool:
        row = await self._db.get(ResearchCollection, collection_id)
        if row is None:
            return False
        await self._db.delete(row)
        await self._db.commit()
        return True

    # --- Research items (JSON snapshots) ---

    async def create_item(self, data: ResearchItemCreate) -> ResearchItemRead:
        if data.type not in RESEARCH_ITEM_TYPES:
            raise ValueError(f"Invalid research item type: {data.type}")
        if data.collection_id is not None:
            coll = await self._db.get(ResearchCollection, data.collection_id)
            if coll is None:
                raise ValueError("Collection not found")
        row = ResearchItem(
            collection_id=data.collection_id,
            type=data.type,
            title=data.title.strip(),
            payload_json=data.payload_json,
            notes=(data.notes or "").strip(),
            tags=data.tags,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        return ResearchItemRead.model_validate(row)

    async def list_items(
        self,
        *,
        collection_id: int | None = None,
        item_type: str | None = None,
        limit: int = 200,
    ) -> list[ResearchItemRead]:
        stmt = select(ResearchItem).order_by(ResearchItem.created_at.desc()).limit(limit)
        if collection_id is not None:
            stmt = stmt.where(ResearchItem.collection_id == collection_id)
        if item_type:
            stmt = stmt.where(ResearchItem.type == item_type)
        result = await self._db.execute(stmt)
        return [ResearchItemRead.model_validate(r) for r in result.scalars().all()]

    async def get_item(self, item_id: int) -> ResearchItemRead | None:
        row = await self._db.get(ResearchItem, item_id)
        if row is None:
            return None
        return ResearchItemRead.model_validate(row)

    async def update_item(
        self, item_id: int, data: ResearchItemUpdate
    ) -> ResearchItemRead | None:
        row = await self._db.get(ResearchItem, item_id)
        if row is None:
            return None
        if data.collection_id is not None:
            if data.collection_id != 0:
                coll = await self._db.get(ResearchCollection, data.collection_id)
                if coll is None:
                    raise ValueError("Collection not found")
            row.collection_id = data.collection_id if data.collection_id != 0 else None
        if data.notes is not None:
            row.notes = data.notes
        if data.tags is not None:
            row.tags = data.tags
        await self._db.commit()
        await self._db.refresh(row)
        return ResearchItemRead.model_validate(row)

    async def delete_item(self, item_id: int) -> bool:
        row = await self._db.get(ResearchItem, item_id)
        if row is None:
            return False
        await self._db.delete(row)
        await self._db.commit()
        return True

    # --- Aggregates ---

    async def get_workspace(self) -> ResearchWorkspace:
        """Full research page sections."""
        insights = await self.list_insights(200)
        notes = await self.list_notes(200)
        items = await self.list_items(limit=200)
        collections = await self.list_collections()
        return ResearchWorkspace(
            insights=insights,
            notes=notes,
            creator_findings=[i for i in insights if i.source_type == "creator_profile"],
            comparisons=[i for i in insights if i.source_type == "creator_comparison"],
            collections=collections,
            items=items,
            timeline=items[:30],
        )

    async def get_summary(self) -> ResearchSummary:
        """Recent items for dashboard widgets."""
        insights = await self.list_insights(30)
        notes = await self.list_notes(10)
        return ResearchSummary(
            recent_insights=insights[:8],
            creator_findings=[i for i in insights if i.source_type == "creator_profile"][:6],
            saved_comparisons=[i for i in insights if i.source_type == "creator_comparison"][:6],
            recent_notes=notes[:5],
            total_insights=len(insights),
            total_notes=len(notes),
        )

    # --- Search ---

    async def search(self, query: str, limit: int = 40) -> list[ResearchSearchResult]:
        """Search insights and notes by text, creator, or tags."""
        pattern = f"%{query.lower()}%"

        insight_stmt = select(SavedInsight).where(
            or_(
                SavedInsight.insight_text.ilike(pattern),
                SavedInsight.source_reference.ilike(pattern),
            )
        ).limit(limit)
        note_stmt = select(ResearchNote).where(
            or_(
                ResearchNote.title.ilike(pattern),
                ResearchNote.content.ilike(pattern),
                ResearchNote.creator_name.ilike(pattern),
            )
        ).limit(limit)
        item_stmt = select(ResearchItem).where(
            or_(
                ResearchItem.title.ilike(pattern),
                ResearchItem.notes.ilike(pattern),
                ResearchItem.type.ilike(pattern),
            )
        ).limit(limit)

        hits: list[ResearchSearchResult] = []

        for row in (await self._db.execute(insight_stmt)).scalars().all():
            if self._tags_match(row.tags, query):
                pass  # already matched by ilike or include tag-only matches below
            hits.append(
                ResearchSearchResult(
                    kind="insight",
                    id=row.id,
                    title=row.source_type.replace("_", " ").title(),
                    snippet=row.insight_text[:200],
                    tags=list(row.tags or []),
                    source_type=row.source_type,
                )
            )

        for row in (await self._db.execute(note_stmt)).scalars().all():
            hits.append(
                ResearchSearchResult(
                    kind="note",
                    id=row.id,
                    title=row.title,
                    snippet=row.content[:200],
                    creator_name=row.creator_name,
                    tags=list(row.tags or []),
                )
            )

        for row in (await self._db.execute(item_stmt)).scalars().all():
            hits.append(
                ResearchSearchResult(
                    kind="item",
                    id=row.id,
                    title=row.title,
                    snippet=(row.notes or row.type)[:200],
                    tags=list(row.tags or []),
                    source_type=row.type,
                )
            )

        # Tag-only insight/note matches
        all_insights = await self.list_insights(100)
        all_notes = await self.list_notes(100)
        seen = {(h.kind, h.id) for h in hits}

        for ins in all_insights:
            if (ins.id, "insight") not in {(i.id, i.kind) for i in hits} and self._tags_match_list(ins.tags, query):
                key = ("insight", ins.id)
                if key not in seen:
                    hits.append(
                        ResearchSearchResult(
                            kind="insight",
                            id=ins.id,
                            title=ins.source_type,
                            snippet=ins.insight_text[:200],
                            tags=ins.tags,
                            source_type=ins.source_type,
                        )
                    )
                    seen.add(key)

        for note in all_notes:
            if self._tags_match_list(note.tags, query):
                key = ("note", note.id)
                if key not in seen:
                    hits.append(
                        ResearchSearchResult(
                            kind="note",
                            id=note.id,
                            title=note.title,
                            snippet=note.content[:200],
                            creator_name=note.creator_name,
                            tags=note.tags,
                        )
                    )

        return hits[:limit]

    # --- Export ---

    async def export_markdown(self) -> ExportMarkdown:
        """Export entire workspace as markdown for copy/download."""
        workspace = await self.get_workspace()
        lines: list[str] = ["# ContentGraph Lite — Research Export", ""]

        lines.append("## Saved Insights")
        for item in workspace.insights:
            lines.append(f"- **{item.source_type}** ({item.source_reference}): {item.insight_text}")
            if item.tags:
                lines.append(f"  - tags: {', '.join(item.tags)}")
        lines.append("")

        lines.append("## Creator Findings")
        for item in workspace.creator_findings:
            lines.append(f"- {item.insight_text}")
        lines.append("")

        lines.append("## Comparisons")
        for item in workspace.comparisons:
            lines.append(f"- {item.insight_text}")
        lines.append("")

        lines.append("## Research Items (snapshots)")
        for item in workspace.items:
            lines.append(f"### [{item.type}] {item.title}")
            if item.notes:
                lines.append(item.notes)
            if item.tags:
                lines.append(f"*Tags: {', '.join(item.tags)}*")
            lines.append("")

        lines.append("## Research Notes")
        for note in workspace.notes:
            lines.append(f"### {note.title}")
            if note.creator_name:
                lines.append(f"*Creator: {note.creator_name}*")
            lines.append(note.content)
            if note.tags:
                lines.append(f"*Tags: {', '.join(note.tags)}*")
            lines.append("")

        return ExportMarkdown(markdown="\n".join(lines))

    @staticmethod
    def _tags_match(tags: list | None, query: str) -> bool:
        if not tags:
            return False
        q = query.lower()
        return any(q in str(t).lower() for t in tags)

    @staticmethod
    def _tags_match_list(tags: list[str], query: str) -> bool:
        q = query.lower()
        return any(q in t.lower() for t in tags)
