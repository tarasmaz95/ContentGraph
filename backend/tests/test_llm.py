"""ChatOpenAI factory — GPT-5 temperature handling."""

from app.services.settings.llm import model_supports_temperature


def test_gpt5_family_rejects_custom_temperature() -> None:
    for model in (
        "gpt-5.5",
        "gpt-5.4",
        "gpt-5.3-instant",
        "gpt-5.2",
        "gpt-5.1",
        "gpt-5",
        "gpt-5-mini",
        "gpt-5-nano",
    ):
        assert model_supports_temperature(model) is False


def test_gpt41_supports_temperature() -> None:
    assert model_supports_temperature("gpt-4.1") is True
    assert model_supports_temperature("gpt-4.1-mini") is True
