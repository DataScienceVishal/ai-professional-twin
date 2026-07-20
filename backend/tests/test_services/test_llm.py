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


@pytest.mark.asyncio
async def test_stream_with_tools_no_tool_call(llm_service: LLMService) -> None:
    """When the LLM responds with text only, stream_with_tools yields text chunks."""

    async def mock_stream():
        for text in ["Hello ", "world"]:
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta.content = text
            chunk.choices[0].delta.tool_calls = None
            chunk.choices[0].finish_reason = None
            yield chunk
        final = MagicMock()
        final.choices = [MagicMock()]
        final.choices[0].delta.content = None
        final.choices[0].delta.tool_calls = None
        final.choices[0].finish_reason = "stop"
        yield final

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_stream()

        from app.tools import ToolRegistry

        registry = ToolRegistry()

        events = []
        async for event in llm_service.stream_with_tools(
            system_prompt="Test",
            messages=[{"role": "user", "content": "Hi"}],
            tool_definitions=[],
            tool_registry=registry,
        ):
            events.append(event)

    text_events = [e for e in events if e["type"] == "chunk"]
    assert len(text_events) == 2
    assert text_events[0]["content"] == "Hello "


@pytest.mark.asyncio
async def test_stream_with_tools_executes_tool(llm_service: LLMService) -> None:
    """When the LLM makes a tool call, the method executes it and re-calls the LLM."""
    call_count = 0

    async def mock_create_fn(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        if call_count == 1:

            async def tool_call_stream():
                chunk = MagicMock()
                chunk.choices = [MagicMock()]
                chunk.choices[0].delta.content = None
                tc = MagicMock()
                tc.index = 0
                tc.id = "call_123"
                tc.function.name = "test_tool"
                tc.function.arguments = '{"arg": "value"}'
                chunk.choices[0].delta.tool_calls = [tc]
                chunk.choices[0].finish_reason = None
                yield chunk
                final = MagicMock()
                final.choices = [MagicMock()]
                final.choices[0].delta.content = None
                final.choices[0].delta.tool_calls = None
                final.choices[0].finish_reason = "tool_calls"
                yield final

            return tool_call_stream()
        else:

            async def text_stream():
                chunk = MagicMock()
                chunk.choices = [MagicMock()]
                chunk.choices[0].delta.content = "Tool result used"
                chunk.choices[0].delta.tool_calls = None
                chunk.choices[0].finish_reason = None
                yield chunk
                final = MagicMock()
                final.choices = [MagicMock()]
                final.choices[0].delta.content = None
                final.choices[0].delta.tool_calls = None
                final.choices[0].finish_reason = "stop"
                yield final

            return text_stream()

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.side_effect = mock_create_fn

        from app.tools import ToolRegistry

        registry = ToolRegistry()

        async def test_tool(arg: str) -> str:
            return f"result: {arg}"

        registry.register("test_tool", test_tool)

        events = []
        async for event in llm_service.stream_with_tools(
            system_prompt="Test",
            messages=[{"role": "user", "content": "Use tool"}],
            tool_definitions=[],
            tool_registry=registry,
        ):
            events.append(event)

    tool_starts = [e for e in events if e["type"] == "tool_start"]
    tool_results = [e for e in events if e["type"] == "tool_result"]
    chunks = [e for e in events if e["type"] == "chunk"]

    assert len(tool_starts) == 1
    assert tool_starts[0]["tool"] == "test_tool"
    assert len(tool_results) == 1
    assert len(chunks) == 1
    assert call_count == 2
