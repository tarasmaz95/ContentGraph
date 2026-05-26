"""
Deterministic transcript analysis — no LLM required.

Splits transcript into segments, detects CTAs, themes, and emotional phrases.
"""

import re
from collections import Counter

from app.schemas.video_intelligence import KeyMoment, TranscriptIntelligence
from app.services.analytics.pattern_detection import EMOTIONAL_WORDS

# Common YouTube CTA phrases
CTA_PATTERNS = [
    r"\bsubscribe\b",
    r"\blike this video\b",
    r"\bcomment below\b",
    r"\blink in the description\b",
    r"\bcheck out\b",
    r"\bfree guide\b",
    r"\bjoin\b",
    r"\bfollow me\b",
]

STRUCTURE_LABELS = [
    ("hook", 0, 12),
    ("intro", 12, 25),
    ("body", 25, 75),
    ("cta", 75, 90),
    ("closing", 90, 100),
]


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if len(p.strip()) > 15]


def analyze_transcript(text: str | None, preview_len: int = 500) -> TranscriptIntelligence:
    """Build transcript intelligence from raw transcript text."""
    if not text or not text.strip():
        return TranscriptIntelligence(preview="", full_available=False)

    clean = text.strip()
    preview = clean[:preview_len] + ("…" if len(clean) > preview_len else "")

    sentences = _sentences(clean)
    words = re.findall(r"[a-z']+", clean.lower())
    stop = {
        "the", "a", "an", "to", "in", "on", "for", "of", "and", "or", "is", "it",
        "you", "your", "with", "this", "that", "from", "at", "by", "how", "what",
        "are", "was", "were", "be", "have", "has", "had", "not", "but", "they",
    }
    word_counts: Counter[str] = Counter()
    for w in words:
        if len(w) > 4 and w not in stop:
            word_counts[w] += 1

    themes = [f"{w} ({c}×)" for w, c in word_counts.most_common(8)]

    emotional: list[str] = []
    for w in words:
        if w in EMOTIONAL_WORDS and w not in emotional:
            emotional.append(w)
    emotional = emotional[:12]

    cta_sections: list[str] = []
    for sent in sentences:
        lower = sent.lower()
        for pat in CTA_PATTERNS:
            if re.search(pat, lower, re.IGNORECASE):
                cta_sections.append(sent[:200])
                break

    # Key moments: pick strong sentences (longer + emotional words)
    scored: list[tuple[float, str, int]] = []
    total = max(len(sentences), 1)
    for i, sent in enumerate(sentences):
        lower = sent.lower()
        score = len(sent.split()) * 0.1
        score += sum(2 for w in EMOTIONAL_WORDS if w in lower)
        if "?" in sent:
            score += 1.5
        scored.append((score, sent, i))

    scored.sort(key=lambda x: -x[0])
    key_moments: list[KeyMoment] = []
    for score, sent, idx in scored[:6]:
        pct = round(100 * idx / total, 1)
        key_moments.append(
            KeyMoment(
                label=f"Moment ~{pct:.0f}%",
                excerpt=sent[:280],
                start_pct=pct,
            )
        )

    # Strongest insights = top thematic sentences
    strongest = [s for _, s, _ in scored[:5]]

    return TranscriptIntelligence(
        preview=preview,
        full_available=True,
        key_moments=key_moments,
        strongest_insights=strongest,
        repeated_themes=themes,
        cta_sections=cta_sections[:6],
        emotional_phrases=emotional,
    )


def structure_timeline_chunks(text: str) -> list[tuple[str, float, float]]:
    """
    Map transcript length to structural segments (hook, intro, body, cta, closing).

    Returns (label, start_pct, end_pct) for charting.
    """
    if not text:
        return []
    n = len(text)
    chunks: list[tuple[str, float, float]] = []
    for label, start, end in STRUCTURE_LABELS:
        s_idx = int(n * start / 100)
        e_idx = int(n * end / 100)
        excerpt = text[s_idx:e_idx].strip()
        word_count = len(excerpt.split())
        chunks.append((label, float(start), float(end)))
    return chunks


def topic_frequency_chart(text: str, top_n: int = 12) -> list[tuple[str, int]]:
    """Word frequency for chart — meaningful tokens only."""
    if not text:
        return []
    words = re.findall(r"[a-z']+", text.lower())
    stop = {
        "the", "a", "an", "to", "in", "on", "for", "of", "and", "or", "is", "it",
        "you", "your", "with", "this", "that", "from", "at", "by", "how", "what",
    }
    counts: Counter[str] = Counter()
    for w in words:
        if len(w) > 4 and w not in stop:
            counts[w] += 1
    return counts.most_common(top_n)
