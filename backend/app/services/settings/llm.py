"""Create ChatOpenAI instances using DB model settings with .env fallback."""

from __future__ import annotations

from langchain_openai import ChatOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services.settings.app_settings_service import AppSettingsService


def model_supports_temperature(model: str) -> bool:
    """
    GPT-5 family models reject custom temperature (OpenAI API 400).

    Only pass temperature to models that accept it.
    """
    name = model.lower().strip()
    if name.startswith("gpt-5"):
        return False
    return True


async def get_chat_llm(
    db: AsyncSession,
    *,
    temperature: float = 0.3,
) -> ChatOpenAI:
    """Resolve model from AppSettings, then build LangChain client."""
    settings = get_settings()
    model = await AppSettingsService(db).resolve_openai_model()
    kwargs: dict[str, object] = {
        "model": model,
        "api_key": settings.openai_api_key,
    }
    if model_supports_temperature(model):
        kwargs["temperature"] = temperature
    return ChatOpenAI(**kwargs)
