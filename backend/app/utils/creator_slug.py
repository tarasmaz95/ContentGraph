"""URL slug helpers — /creators/dan-koe maps to creator name in DB."""

import re


def slugify_creator_name(name: str) -> str:
    """Convert display name to URL slug: 'Dan Koe' -> 'dan-koe'."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    return slug.strip("-")


def slug_to_search_terms(slug: str) -> str:
    """Convert slug back to spaced name for fuzzy DB lookup."""
    return slug.replace("-", " ").strip()
