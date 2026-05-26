"""Deterministic title/hook pattern detection — no LLM, pure Python rules."""

import re
from dataclasses import dataclass

# Emotional / power words commonly used in high-performing YouTube titles
EMOTIONAL_WORDS = frozenset({
    "amazing", "insane", "secret", "shocking", "ultimate", "powerful",
    "proven", "breakthrough", "mistake", "truth", "never", "always",
    "best", "worst", "easy", "hard", "free", "new", "stop", "start",
    "love", "hate", "fear", "dream", "success", "fail", "win", "lose",
})

# Curiosity triggers in titles
CURIOSITY_PATTERNS = [
    (r"\?", "question"),
    (r"\bwhy\b", "why"),
    (r"\bhow\b", "how"),
    (r"\bsecret\b", "secret"),
    (r"\btruth\b", "truth"),
    (r"\bnobody\b", "nobody"),
    (r"\bdon'?t\b", "dont"),
    (r"\bwhat\b", "what"),
    (r"\bthis is why\b", "this_is_why"),
]

# Transformation / outcome hooks
TRANSFORMATION_PATTERNS = [
    (r"\btransform\b", "transform"),
    (r"\bchange your\b", "change_your"),
    (r"\bbecome\b", "become"),
    (r"\bfrom .+ to\b", "from_to"),
    (r"\bin \d+ (days|weeks|months)\b", "timeframe"),
    (r"\bstep[- ]by[- ]step\b", "step_by_step"),
]

# Urgency hooks
URGENCY_PATTERNS = [
    (r"\bnow\b", "now"),
    (r"\btoday\b", "today"),
    (r"\bbefore\b", "before"),
    (r"\bright now\b", "right_now"),
    (r"\bwatch this\b", "watch_this"),
    (r"\bstop\b", "stop"),
    (r"\bwarning\b", "warning"),
]

HOW_TO_PATTERN = re.compile(r"\bhow\s+to\b", re.IGNORECASE)
NUMBERS_PATTERN = re.compile(r"\d+")


@dataclass
class TitleFeatures:
    """Extracted features from a single video title."""

    length: int
    has_numbers: bool
    has_how_to: bool
    emotional_words: list[str]
    curiosity_tags: list[str]
    transformation_tags: list[str]
    urgency_tags: list[str]
    primary_hook: str


def _match_patterns(title: str, patterns: list[tuple[str, str]]) -> list[str]:
    lower = title.lower()
    tags: list[str] = []
    for regex, tag in patterns:
        if re.search(regex, lower, re.IGNORECASE):
            tags.append(tag)
    return tags


def extract_title_features(title: str) -> TitleFeatures:
    """Parse one title into measurable features for analytics services."""
    lower = title.lower()
    words = re.findall(r"[a-z']+", lower)

    emotional = [w for w in words if w in EMOTIONAL_WORDS]
    curiosity = _match_patterns(title, CURIOSITY_PATTERNS)
    transformation = _match_patterns(title, TRANSFORMATION_PATTERNS)
    urgency = _match_patterns(title, URGENCY_PATTERNS)

    # Primary hook = first detected category (priority order)
    primary = "general"
    if HOW_TO_PATTERN.search(title):
        primary = "how_to"
    elif curiosity:
        primary = f"curiosity:{curiosity[0]}"
    elif transformation:
        primary = f"transformation:{transformation[0]}"
    elif urgency:
        primary = f"urgency:{urgency[0]}"
    elif emotional:
        primary = "emotional"
    elif NUMBERS_PATTERN.search(title):
        primary = "numbers"

    return TitleFeatures(
        length=len(title),
        has_numbers=bool(NUMBERS_PATTERN.search(title)),
        has_how_to=bool(HOW_TO_PATTERN.search(title)),
        emotional_words=emotional,
        curiosity_tags=curiosity,
        transformation_tags=transformation,
        urgency_tags=urgency,
        primary_hook=primary,
    )


def length_bucket(char_count: int) -> str:
    """Bucket title length for chart: short / medium / long."""
    if char_count < 40:
        return "short (<40)"
    if char_count < 70:
        return "medium (40-69)"
    return "long (70+)"
