# User Guide

ContentGraph Lite helps you research YouTube creators from a **Google Sheets catalog** with AI-powered search, hooks, scripts, audience insights, and a persistent **copilot sidebar**.

---

## Getting Started

### First visit: Onboarding

1. Open **http://localhost:3000** — you may be redirected to `/welcome`
2. Complete the short onboarding (what the product does, how to sync)
3. On completion, the app remembers via `localStorage` and sends you to the dashboard

### Essential first step: Sync data

1. Go to **Dashboard** (`/dashboard`)
2. Click **Sync Google Sheets**
3. Wait for the result — you should see counts for created/updated rows, embeddings, transcripts, hooks, and comments

Without sync, most pages will be empty.

---

## Navigation

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/dashboard` | Video catalog, search, sync |
| Creators | `/creators` | Browse creators |
| Creator detail | `/creators/[name]` | Deep creator intelligence |
| Hooks | `/hooks` | Hook index + generation |
| Scripts | `/scripts` | Script generation + analysis |
| Videos | `/videos/[id]` | Single video intelligence |
| Research | `/research` | Saved insights + notes |
| Feed | `/feed` | Daily intelligence signals |
| Chat | `/chat` | AI research assistant |
| Analytics | `/analytics` | Charts and patterns |
| Welcome | `/welcome` | Onboarding |

**⌘K (Ctrl+K)** — Command palette: jump to pages, run example prompts.

**Copilot sidebar** — Always visible on the right; updates based on the page you're on.

---

## Sync Google Sheets

### Spreadsheet format

Header row (flexible names):

| Name | URL | Subscribers | Titles | Views | Date |
|------|-----|-------------|--------|-------|------|

Each row = one video.

### What sync does

1. Imports/updates videos in the database
2. Embeds titles (semantic search)
3. Fetches transcripts (up to configured limit)
4. Rebuilds hook index
5. Fetches YouTube comments (if API key set)

### When to re-sync

- After editing the spreadsheet
- When adding new creators or videos
- When you need fresh comment data

---

## AI Chat (`/chat`)

The main natural-language interface. Ask research questions; the system routes to specialized analysis.

### How it works

1. Type a question
2. Backend classifies intent (creator, hooks, video, audience, etc.)
3. Retrieves relevant videos from your catalog
4. Returns markdown answer + insight bullets + structured data + follow-up suggestions

### Example prompts

**Creators:**
- "What makes Dan Koe successful?"
- "Compare Dan Koe vs Hormozi"
- "What communication style works best for educational creators?"

**Hooks:**
- "Which curiosity hooks generate highest engagement?"
- "Generate 10 identity hooks for Dan Koe about discipline"
- "Which hooks perform best for AI videos?"

**Scripts:**
- "Generate a Dan Koe script about discipline"
- "Write a 10 minute philosophical script about focus"
- "Analyze this creator's speaking style from transcripts"

**Videos:**
- "Why did video 42 go viral?" (use real ID from dashboard)
- "What are the key themes in this video's transcript?"
- "What does the audience think about this video?"

**Audience / comments:**
- "What audience pain points appear most in comments?"
- "Summarize comment sentiment for video 15"

**Trends:**
- "What topics are trending in my catalog?"
- "Which keywords are rising fastest?"

Click **suggestion chips** under responses to continue the conversation.

### Deep link

`/chat?q=What+makes+Dan+Koe+successful` — pre-fills the first message.

---

## Creators

### List (`/creators`)

- See all creators from synced videos
- Open a creator for the intelligence page

### Creator page (`/creators/[name]`)

- AI profile (style, topics, hooks, audience)
- Charts: views, hook types, topics
- Semantic search within creator
- **Save Insight** — send findings to Research workspace
- Refresh profile when catalog grew

**Workflow:** Sync → open creator → review charts → ask chat "Generate hooks for this creator" → save insights.

---

## Hooks (`/hooks`)

### Browse indexed hooks

- Search bar uses hook index (`/hooks/search`)
- See type distribution and top performers

### Generate hooks

Use the form or chat:
- Pick creator, topic, hook type (curiosity, identity, contrarian, …)
- API returns ranked hooks with rationale

### Compare hook types

Compare effectiveness between types or creators.

### Reindex

If hooks look stale after sync issues, trigger reindex from UI (calls `POST /hooks/reindex`).

---

## Scripts (`/scripts`)

### Generate

- Creator + topic + tone + duration
- Output: structured script with hook, sections, CTA

### Analyze

- Paste a script or analyze creator style from transcripts

### Compare

- Two creators' script patterns for a topic

**Workflow:** Research creator → generate hooks → generate script → save best lines to Research.

---

## Videos (`/videos/[id]`)

Open from dashboard click or URL with numeric ID.

### Sections

- Overview (views, creator, date)
- **Intelligence** — breakdown, transcript themes, viral factors
- **Similar videos** — semantic neighbors
- **Audience** — comments, sentiment chart, pain points, questions
- Fetch comments manually if sync didn't include this video

**Workflow:** Find outlier on dashboard → open video → read audience section → ask chat "Why did this perform well?"

---

## Research Workspace (`/research`)

Your persistent notebook.

### Saved insights

- Save from chat responses or creator/video pages
- Tag by topic (hooks, audience, comparison)
- Search across all saved content

### Notes

- Write free-form notes linked to creators
- Types: general, creator_finding, comparison, observation

### Export

- Download full workspace as **Markdown** for reports/decks

### Research assistant (copilot)

Hints for related insights and tags based on what you've saved.

---

## Copilot Sidebar

Available on every page (right panel).

### What it shows

- **Smart insights** — stats from your catalog ("Identity hooks outperform average by X%")
- **Recommendations** — next pages or actions
- **Brief** — short scannable summary for current creator/video

### Personalization

The app remembers:
- Recent searches
- Creators you've viewed

This tunes recommendations (stored locally, sent to API).

---

## Intelligence Feed (`/feed`)

Daily-style cards without running full chat:

- Viral trends in your catalog
- Rising keywords
- Hook opportunities
- Anomalies (view spikes)

Click prompt chips to explore further in Chat.

---

## Analytics (`/analytics`)

Visual dashboard:

- Views distribution
- Keyword frequency
- Creator comparison chart
- Hook type distribution
- Title length vs views

Use for presentations; pair with Chat for interpretation.

---

## Command Palette (⌘K)

Quick actions:

- Go to Dashboard, Creators, Hooks, Scripts, Research, Feed, Chat
- Run curated prompts (same as empty-state chips)
- Semantic search shortcuts

---

## Recommended Workflows

### Workflow 1: New creator in sheet

1. Add rows to Google Sheet
2. Sync on Dashboard
3. Open creator page — refresh profile
4. Chat: "What hook types work best for [creator]?"
5. Save top insights to Research

### Workflow 2: Find viral pattern

1. Analytics → spot hook type or keyword spike
2. Feed → confirm trend card
3. Hooks → search matching patterns
4. Chat: "Which videos use this pattern and why do they work?"

### Workflow 3: Audience-led content idea

1. Open high-performing video
2. Fetch comments if missing
3. Read pain points / questions
4. Chat: "Generate hooks addressing [pain point] for [creator]"
5. Scripts → generate full script
6. Export research markdown

### Workflow 4: Competitive comparison

1. Chat: "Compare Creator A vs Creator B"
2. Save comparison insight
3. Creators → open each for charts
4. Notes → write positioning takeaway

---

## Tips

- **Use video IDs** from the dashboard when asking about a specific video
- **Re-sync** after sheet changes before trusting feed/copilot stats
- **Set `YOUTUBE_API_KEY`** for audience features
- **Set `OPENAI_API_KEY`** for chat, generation, and embeddings
- Prefer **semantic search** for concepts ("identity transformation"); **keyword search** for exact words

---

## Related Docs

- [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) — configuration
- [API_REFERENCE.md](./API_REFERENCE.md) — endpoints
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) — architecture
