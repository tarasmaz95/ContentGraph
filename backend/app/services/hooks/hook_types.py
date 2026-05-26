"""Canonical hook types for Hook Intelligence System."""

from typing import Literal

# All supported hook categories
HookType = Literal[
    "curiosity",
    "urgency",
    "transformation",
    "authority",
    "fear_loss",
    "identity",
    "contrarian",
    "prediction",
    "social_proof",
    "how_to",
    "general",
]

HOOK_TYPE_LABELS: dict[str, str] = {
    "curiosity": "Curiosity",
    "urgency": "Urgency",
    "transformation": "Transformation",
    "authority": "Authority",
    "fear_loss": "Fear / Loss",
    "identity": "Identity",
    "contrarian": "Contrarian",
    "prediction": "Prediction",
    "social_proof": "Social Proof",
    "how_to": "How-To",
    "general": "General",
}

ALL_HOOK_TYPES: list[str] = [
    "curiosity",
    "urgency",
    "transformation",
    "authority",
    "fear_loss",
    "identity",
    "contrarian",
    "prediction",
    "social_proof",
]
