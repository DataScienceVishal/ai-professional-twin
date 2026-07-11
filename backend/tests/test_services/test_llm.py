from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm import LLMService


@pytest.fixture
def llm_service() -> LLMService:
    return LLMService(
        api_key="test-key",
        base_url="https://models.github.ai/inference",
        model="gpt-4.1-mini",
    )


@pytest.mark.asyncio
async def test_chat_returns_text(llm_service: LLMService) -> None:
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Vishal is an AI Engineer"
    mock_response.choices = [mock_choice]

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_response
        result = await llm_service.chat(
            system_prompt="You are a test assistant",
            messages=[{"role": "user", "content": "Who is Vishal?"}],
        )

    assert result == "Vishal is an AI Engineer"


@pytest.mark.asyncio
async def test_stream_yields_chunks(llm_service: LLMService) -> None:
    async def mock_stream():
        for text in ["Vishal ", "is ", "great"]:
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta.content = text
            yield chunk

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_stream()
        chunks = []
        async for chunk in llm_service.stream(
            system_prompt="Test",
            messages=[{"role": "user", "content": "Hi"}],
        ):
            chunks.append(chunk)

    assert chunks == ["Vishal ", "is ", "great"]
