"""Section mapping and audience theme rules for the research briefing feed."""

from __future__ import annotations

# UI section ids
SECTION_BREAKOUTS = "breakouts"
SECTION_CREATORS = "creators"
SECTION_AUDIENCE = "audience"
SECTION_HOOKS = "hooks"

CATEGORY_BREAKOUT = "breakout"
CATEGORY_CREATOR_GROWTH = "creator_growth"
CATEGORY_CREATOR_STRENGTH = "creator_strength"
CATEGORY_AUDIENCE = "audience"
CATEGORY_HOOK_PATTERN = "hook_pattern"

# Emotional themes worth surfacing (skip neutral-only)
AUDIENCE_THEMES: frozenset[str] = frozenset(
    {
        "skepticism",
        "confusion",
        "inspiration",
        "motivation",
        "curiosity",
        "excitement",
        "positive",
        "negative",
    }
)

THEME_LABELS: dict[str, str] = {
    "skepticism": "skepticism and doubt",
    "confusion": "confusion and unanswered questions",
    "inspiration": "inspiration",
    "motivation": "motivation and discipline",
    "curiosity": "curiosity and follow-up questions",
    "excitement": "excitement",
    "positive": "strong positive reinforcement",
    "negative": "pushback and criticism",
}

HOOK_TYPE_LABELS: dict[str, str] = {
    "curiosity": "Curiosity",
    "urgency": "Urgency",
    "transformation": "Transformation",
    "authority": "Authority",
    "fear_loss": "Fear / loss",
    "identity": "Identity",
    "contrarian": "Contrarian",
    "prediction": "Prediction",
    "social_proof": "Social proof",
    "how_to": "How-to",
    "general": "General",
}


def category_to_section(category: str) -> str:
    if category == CATEGORY_BREAKOUT:
        return SECTION_BREAKOUTS
    if category in (CATEGORY_CREATOR_GROWTH, CATEGORY_CREATOR_STRENGTH):
        return SECTION_CREATORS
    if category == CATEGORY_AUDIENCE:
        return SECTION_AUDIENCE
    if category == CATEGORY_HOOK_PATTERN:
        return SECTION_HOOKS
    return SECTION_CREATORS


def audience_theme_label(theme: str) -> str:
    return THEME_LABELS.get(theme, theme.replace("_", " "))


def hook_label(hook_type: str) -> str:
    return HOOK_TYPE_LABELS.get(hook_type, hook_type.replace("_", " ").title())
