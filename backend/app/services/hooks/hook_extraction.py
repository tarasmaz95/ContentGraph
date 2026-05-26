"""
Hook extraction engine — analyzes titles and transcript openings.

Rule-based detection with confidence scores; no LLM required for indexing.
"""

import re
from dataclasses import dataclass

from app.services.analytics.pattern_detection import (
    CURIOSITY_PATTERNS,
    EMOTIONAL_WORDS,
    TRANSFORMATION_PATTERNS,
    URGENCY_PATTERNS,
    extract_title_features,
)

# Regex signals per hook type (title + optional transcript prefix)
AUTHORITY_PATTERNS = [
    (r"\bexpert\b", "expert"),
    (r"\bproven\b", "proven"),
    (r"\bscientist\b", "scientist"),
    (r"\bdoctor\b", "doctor"),
    (r"\bceo\b", "ceo"),
    (r"\b#\d+\b", "ranked"),
    (r"\byears of\b", "experience"),
    (r"\bofficial\b", "official"),
]

FEAR_LOSS_PATTERNS = [
    (r"\bmistake\b", "mistake"),
    (r"\bnever\b", "never"),
    (r"\bavoid\b", "avoid"),
    (r"\blosing\b", "losing"),
    (r"\bfail\b", "fail"),
    (r"\bwarning\b", "warning"),
    (r"\bdon'?t\b", "dont"),
    (r"\bworst\b", "worst"),
    (r"\bregret\b", "regret"),
]

IDENTITY_PATTERNS = [
    (r"\bwho you\b", "who_you"),
    (r"\byour life\b", "your_life"),
    (r"\bidentity\b", "identity"),
    (r"\bself\b", "self"),
    (r"\bperson you\b", "person"),
    (r"\bbecome the\b", "become"),
    (r"\bversion of yourself\b", "version"),
    (r"\bmindset\b", "mindset"),
]

CONTRARIAN_PATTERNS = [
    (r"\bwrong\b", "wrong"),
    (r"\blie\b", "lie"),
    (r"\bmyth\b", "myth"),
    (r"\bunpopular\b", "unpopular"),
    (r"\bactually\b", "actually"),
    (r"\bstop believing\b", "stop_believing"),
    (r"\beveryone is\b", "everyone"),
    (r"\boverrated\b", "overrated"),
]

PREDICTION_PATTERNS = [
    (r"\b202\d\b", "year"),
    (r"\bfuture\b", "future"),
    (r"\bwill change\b", "will_change"),
    (r"\bnext\b", "next"),
    (r"\bpredict\b", "predict"),
    (r"\bcoming\b", "coming"),
    (r"\btrend\b", "trend"),
]

SOCIAL_PROOF_PATTERNS = [
    (r"\bmillion\b", "million"),
    (r"\bviews\b", "views"),
    (r"\beveryone\b", "everyone"),
    (r"\bpeople are\b", "people"),
    (r"\bviral\b", "viral"),
    (r"\bmost popular\b", "popular"),
    (r"\b#\d+\b", "number"),
    (r"\bbreaking\b", "breaking"),
]

TYPE_PATTERN_MAP: dict[str, list[tuple[str, str]]] = {
    "curiosity": CURIOSITY_PATTERNS,
    "urgency": URGENCY_PATTERNS,
    "transformation": TRANSFORMATION_PATTERNS,
    "authority": AUTHORITY_PATTERNS,
    "fear_loss": FEAR_LOSS_PATTERNS,
    "identity": IDENTITY_PATTERNS,
    "contrarian": CONTRARIAN_PATTERNS,
    "prediction": PREDICTION_PATTERNS,
    "social_proof": SOCIAL_PROOF_PATTERNS,
}


@dataclass
class ExtractedHook:
    """One detected hook from a video title (+ optional transcript lead)."""

    hook_text: str
    hook_type: str
    confidence: float
    keywords: list[str]
    emotional_triggers: list[str]
    matched_signals: list[str]


def _match_type(title: str, patterns: list[tuple[str, str]]) -> list[str]:
    lower = title.lower()
    hits: list[str] = []
    for regex, tag in patterns:
        if re.search(regex, lower, re.IGNORECASE):
            hits.append(tag)
    return hits


def _title_keywords(title: str) -> list[str]:
    """Meaningful words from title for search/indexing."""
    stop = {
        "the", "a", "an", "to", "in", "on", "for", "of", "and", "or", "is", "it",
        "you", "your", "with", "this", "that", "from", "at", "by", "how", "what",
    }
    words = re.findall(r"[a-z0-9']+", title.lower())
    return [w for w in words if len(w) > 3 and w not in stop][:12]


def extract_hooks_from_text(
    title: str,
    transcript_prefix: str | None = None,
) -> list[ExtractedHook]:
    """
    Detect all hook types present in title (and first ~300 chars of transcript).

    Returns one ExtractedHook per detected type (multi-label titles allowed).
    """
    combined = title
    if transcript_prefix:
        combined = f"{title} {transcript_prefix[:300]}"

    features = extract_title_features(title)
    emotional = list(features.emotional_words)
    keywords = _title_keywords(title)

    detections: list[tuple[str, list[str], float]] = []

    # How-to is high-priority single type
    if features.has_how_to:
        detections.append(("how_to", ["how_to"], 0.85))

    for hook_type, patterns in TYPE_PATTERN_MAP.items():
        signals = _match_type(combined, patterns)
        if signals:
            # Confidence scales with number of matched signals (cap 0.95)
            conf = min(0.95, 0.45 + 0.12 * len(signals))
            detections.append((hook_type, signals, conf))

    if features.has_numbers and not any(d[0] == "social_proof" for d in detections):
        detections.append(("social_proof", ["numbers"], 0.5))

    if not detections:
        detections.append(("general", [], 0.35))

    # Build hook_text — use title (viral hooks live in titles)
    hook_text = title.strip()[:200]

    results: list[ExtractedHook] = []
    for hook_type, signals, confidence in detections:
        results.append(
            ExtractedHook(
                hook_text=hook_text,
                hook_type=hook_type,
                confidence=round(confidence, 3),
                keywords=keywords,
                emotional_triggers=emotional[:8],
                matched_signals=signals,
            )
        )

    return results


def effectiveness_score(views: int, baseline_views: float) -> float:
    """
    Views correlation proxy: ratio vs baseline (creator or global avg).

    Capped 0–1 for storage; values >1 mean outperforming baseline.
    """
    if baseline_views <= 0:
        return min(1.0, views / 100_000)
    ratio = views / baseline_views
    return round(min(1.0, ratio / 3.0), 3)
