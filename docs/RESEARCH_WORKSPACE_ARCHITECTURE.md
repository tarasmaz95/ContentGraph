# Research Workspace — Architecture (Phase 6 MVP)

## Goal

Turn ContentGraph into a **persistent research memory layer**: save intelligence snapshots, organize into collections, annotate, and reopen frozen payloads — without LangGraph changes, collaboration infra, or vector DB additions.

## Routes

| Route | Purpose |
|-------|---------|
| `/research` | Workspace UI — collections sidebar, item list, detail panel |
| `/research?item={id}` | Deep-link to open a saved item |

Legacy text insights (`saved_insights`) and `research_notes` remain; new work uses **research_items**.

## Entity model

### `research_collections`

| Column | Type |
|--------|------|
| id | serial PK |
| name | varchar(255) |
| created_at | timestamptz |

Flat folders/boards — no nesting in MVP.

### `research_items`

| Column | Type |
|--------|------|
| id | serial PK |
| collection_id | FK nullable → collections (SET NULL on delete) |
| type | varchar(64) indexed |
| title | varchar(512) |
| payload_json | JSONB — **immutable snapshot at save time** |
| notes | text — user annotation (editable) |
| tags | JSONB string[] |
| created_at | timestamptz indexed |

### Item types

| type | Saved from | payload shape |
|------|------------|---------------|
| `creator_compare` | `/compare` | Full `CreatorCompareResult` |
| `creator_snapshot` | `/creators/[name]` | Full `CreatorIntelligence` |
| `hook` | Creator hooks section | `{ creator, hooks }` |
| `breakout_video` | Creator momentum | `VideoBreakoutItem` + creator |
| `audience_insight` | Creator audience | `{ creator, audience }` |
| `semantic_theme` | Creator semantic | `{ creator, semantic }` |
| `feed_signal` | Feed cards | `FeedItem` fields |

## Snapshot philosophy

- **Save-time freeze**: client sends `payload_json` as returned by intelligence/compare APIs; server stores as-is.
- **No recompute on read**: detail view renders stored JSON, not live DB analytics.
- **Notes/tags mutable**: only `notes`, `tags`, `collection_id` via PATCH.
- Compare/creator pages may drift from live data — saved item stays the research record.

## APIs

Base: `/api/v1/research`

| Method | Path | Action |
|--------|------|--------|
| GET | `/workspace` | Collections + items + timeline + legacy insights |
| GET | `/collections` | List collections with item counts |
| POST | `/collections` | Create `{ name }` |
| DELETE | `/collections/{id}` | Delete collection (items → uncategorized) |
| GET | `/items` | List (`?collection_id=&type=`) |
| GET | `/items/{id}` | Single item |
| POST | `/items` | Create snapshot |
| PATCH | `/items/{id}` | Update notes/tags/collection |
| DELETE | `/items/{id}` | Remove item |

Legacy: `/insights`, `/notes` unchanged.

## Save flows

1. User clicks **Save to Research** (`SaveResearchButton`).
2. Frontend POSTs `ResearchItemCreate` with current in-memory payload (no extra API round-trip for analytics).
3. Workspace refreshes on `/research`; user selects item → `ResearchItemDetail` renders by `type`.

## Frontend layout

```
┌─────────────┬──────────────┬────────────────────────┐
│ Collections │ Item list    │ Detail (snapshot)      │
│ sidebar     │ (timeline)   │ + editable notes       │
└─────────────┴──────────────┴────────────────────────┘
```

Not a Notion clone — three columns on desktop, stacked on mobile.

## Reused services

| Source | Reuse |
|--------|-------|
| Compare | `CreatorCompareResult` JSON |
| Creator page | `CreatorIntelligence` JSON |
| Feed | `FeedItem` JSON |
| Hooks/audience/semantic | Section subsets of intelligence |

## Limitations (MVP)

- Single-user / no auth — all research is global to the deployment.
- No full-text search inside `payload_json` (title, notes, tags, type only).
- No versioning of snapshots (re-save = new item).
- Large payloads (full compare ×2 intelligence) — acceptable for MVP.
- Legacy `SaveInsightButton` still writes text-only `saved_insights`.

## Future evolution

- Default collection picker on save
- Item versioning / “refresh snapshot” action
- Export collection as PDF/markdown
- pg_trgm search on payload
- Per-user research when auth exists
- Auto-save from Copilot recommendations

## Verification

```bash
# After migration 011
curl -X POST http://127.0.0.1:8001/api/v1/research/items \
  -H 'Content-Type: application/json' \
  -d '{"type":"semantic_theme","title":"test","payload_json":{"k":1},"tags":["qa"]}'

curl http://127.0.0.1:8001/api/v1/research/items
curl http://127.0.0.1:8001/api/v1/research/workspace
```

1. Save comparison from `/compare` → item appears in workspace  
2. Reopen item → overview/hooks tables render from JSON  
3. Create collection → filter list  
4. Edit notes → PATCH persists  
5. Empty workspace → no crash  

## Files

| Layer | Path |
|-------|------|
| Migration | `alembic/versions/011_create_research_items.py` |
| Models | `app/models/research.py` |
| Service | `app/services/research/research_service.py` |
| API | `app/api/v1/research.py` |
| UI | `frontend/components/research/*`, `frontend/app/research/page.tsx` |
| Save | `frontend/components/research/save-research-button.tsx` |
