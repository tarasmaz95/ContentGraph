"""Lightweight keyword/token cleanup for analytics topics — no ML."""

from __future__ import annotations

import re

# Common title stop words (single tokens only)
_STOP = frozenset(
    {
        "the",
        "a",
        "an",
        "to",
        "in",
        "on",
        "for",
        "of",
        "and",
        "or",
        "is",
        "it",
        "you",
        "your",
        "with",
        "this",
        "that",
        "from",
        "at",
        "by",
        "how",
        "what",
        "are",
        "was",
        "were",
        "be",
        "been",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "can",
        "just",
        "not",
        "but",
        "all",
        "any",
        "our",
        "out",
        "up",
        "so",
        "if",
        "my",
        "me",
        "we",
        "they",
        "them",
        "their",
        "who",
        "why",
        "when",
        "where",
        "which",
        "into",
        "about",
        "than",
        "then",
        "now",
        "new",
        "old",
        "get",
        "got",
        "make",
        "made",
        "use",
        "using",
        "via",
        "vs",
        "sec",
        "secs",
        "min",
        "mins",
        "give",
        "delete",
    }
)

_APOSTROPHE = re.compile(r"[''`´]")
_NON_WORD_RUN = re.compile(r"[^a-z0-9']+")
_CONSECUTIVE_DOTS = re.compile(r"\.{2,}")


def extract_title_tokens(title: str) -> list[str]:
    """Pull normalized word tokens from a title (no punctuation garbage)."""
    lowered = title.lower()
    lowered = _CONSECUTIVE_DOTS.sub(" ", lowered)
    lowered = _APOSTROPHE.sub("'", lowered)
    raw = re.findall(r"[a-z0-9']+", lowered)
    out: list[str] = []
    for token in raw:
        cleaned = sanitize_keyword_token(token)
        if cleaned:
            out.append(cleaned)
    return out


def sanitize_keyword_token(token: str) -> str | None:
    """
    Return a display-safe keyword or None if the token should be dropped.

    Filters fragments like sec..i'll, lone punctuation, and ultra-short noise.
    """
    if not token:
        return None

    raw = token.strip().lower()
    if ".." in raw:
        return None

    t = raw
    t = _APOSTROPHE.sub("'", t)
    t = _NON_WORD_RUN.sub("", t).strip("'.-")

    if len(t) < 3:
        return None
    if ".." in t:
        return None
    if t in _STOP:
        return None
    if t.isdigit():
        return None
    # Mostly non-letters (e.g. app… residue)
    letters = sum(1 for c in t if c.isalpha())
    if letters < 3:
        return None
    if letters / len(t) < 0.5:
        return None
    # Broken apostrophe fragments: i'll is ok; leading/trailing apostrophe junk is not
    if t.startswith("'") or t.endswith("'"):
        t = t.strip("'")
        if len(t) < 3:
            return None
    # Broken merges like seci'll from sec..i'll
    if "'" in t and len(t) < 5:
        return None

    return t
