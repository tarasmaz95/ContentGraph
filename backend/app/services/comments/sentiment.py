"""
Lightweight sentiment + emotional tag detection for comment text.

Rule-based — fast and no extra LLM calls during ingestion.
"""

import re

# Sentiment lexicon (compact — tuned for YouTube comment tone)
POSITIVE_WORDS = frozenset({
    "love", "great", "amazing", "awesome", "thank", "thanks", "helpful",
    "best", "excellent", "perfect", "brilliant", "fantastic", "incredible",
    "inspiring", "motivated", "grateful", "appreciate", "fire", "goat",
})

NEGATIVE_WORDS = frozenset({
    "bad", "hate", "worst", "boring", "terrible", "awful", "wrong",
    "stupid", "trash", "waste", "clickbait", "scam", "cap", "mid",
    "disappointed", "annoying", "useless",
})

# Emotional tag triggers → tag name
EMOTIONAL_RULES: list[tuple[str, list[str]]] = [
    ("inspiration", ["inspir", "life-changing", "mindset", "changed my life"]),
    ("motivation", ["motivat", "discipline", "grind", "consistency", "keep going"]),
    ("confusion", ["confus", "don't understand", "unclear", "what do you mean", "lost"]),
    ("curiosity", ["curious", "wonder", "what if", "how does", "interested"]),
    ("skepticism", ["doubt", "scam", "clickbait", "cap", "sure about", "really?"]),
    ("excitement", ["excited", "hyped", "can't wait", "lets go", "let's go", "🔥"]),
]


def detect_sentiment(text: str) -> str:
    """
    Classify comment as positive, negative, or neutral.

    Uses word hits; questions with no strong signal stay neutral.
    """
    lower = text.lower()
    words = set(re.findall(r"[a-z']+", lower))

    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)

    if pos > neg and pos >= 1:
        return "positive"
    if neg > pos and neg >= 1:
        return "negative"
    return "neutral"


def detect_emotional_tags(text: str) -> list[str]:
    """Match emotional tag categories from phrase patterns."""
    lower = text.lower()
    tags: list[str] = []
    for tag, patterns in EMOTIONAL_RULES:
        for pat in patterns:
            if pat in lower:
                tags.append(tag)
                break
    return tags


def is_question(text: str) -> bool:
    """Heuristic: comment asks a question."""
    t = text.strip()
    if "?" in t:
        return True
    return bool(re.match(r"^(how|why|what|when|where|who|can|could|would|is|are)\b", t, re.I))


def enrich_comment(text: str) -> tuple[str, list[str]]:
    """Returns (sentiment, emotional_tags) for storage."""
    sentiment = detect_sentiment(text)
    tags = detect_emotional_tags(text)
    if is_question(text) and "curiosity" not in tags:
        tags.append("curiosity")
    return sentiment, tags
