from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm import LLMService, is_gpt5_family


@pytest.fixture
def llm_service() -> LLMService:
    return LLMService(
        api_key="test-key",
        model="gpt-5-mini",
        azure_endpoint="https://example.openai.azure.com",
        api_version="2024-10-21",
    )


def _service(model: str, **kwargs: object) -> LLMService:
    return LLMService(api_key="test-key", model=model, **kwargs)  # type: ignore[arg-type]


MESSAGES = [{"role": "user", "content": "hi"}]


@pytest.mark.parametrize(
    "model",
    ["gpt-5", "gpt-5-mini", "GPT-5-Mini", "o1-preview", "o3-mini", "o4-mini"],
)
def test_is_gpt5_family_detects_fixed_temperature_models(model: str) -> None:
    assert is_gpt5_family(model) is True


@pytest.mark.parametrize("model", ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-35-turbo"])
def test_is_gpt5_family_excludes_gpt4_models(model: str) -> None:
    assert is_gpt5_family(model) is False


def test_kwargs_for_gpt5_omit_temperature_and_use_max_completion_tokens() -> None:
    """GPT-5 returns HTTP 400 for any non-default temperature."""
    kwargs = _service("gpt-5-mini", max_output_tokens=512).build_completion_kwargs(
        MESSAGES, stream=False
    )

    assert "temperature" not in kwargs
    assert kwargs["max_completion_tokens"] == 512
    assert "max_tokens" not in kwargs
    assert kwargs["model"] == "gpt-5-mini"


def test_kwargs_for_gpt4_include_temperature_and_max_tokens() -> None:
    kwargs = _service(
        "gpt-4o-mini", temperature=0.3, max_output_tokens=512
    ).build_completion_kwargs(MESSAGES, stream=False)

    assert kwargs["temperature"] == 0.3
    assert kwargs["max_tokens"] == 512
    assert "max_completion_tokens" not in kwargs


def test_send_temperature_override_forces_it_on_for_gpt5() -> None:
    kwargs = _service("gpt-5-mini", temperature=0.7, send_temperature=True).build_completion_kwargs(
        MESSAGES, stream=False
    )

    assert kwargs["temperature"] == 0.7


def test_send_temperature_override_forces_it_off_for_gpt4() -> None:
    kwargs = _service("gpt-4o-mini", send_temperature=False).build_completion_kwargs(
        MESSAGES, stream=False
    )

    assert "temperature" not in kwargs


def test_max_output_tokens_omitted_when_unset() -> None:
    kwargs = _service("gpt-4o-mini").build_completion_kwargs(MESSAGES, stream=False)

    assert "max_tokens" not in kwargs
    assert "max_completion_tokens" not in kwargs


def test_stream_kwargs_request_usage_when_enabled() -> None:
    kwargs = _service("gpt-5-mini", stream_usage=True).build_completion_kwargs(
        MESSAGES, stream=True
    )

    assert kwargs["stream"] is True
    assert kwargs["stream_options"] == {"include_usage": True}


def test_stream_usage_can_be_disabled() -> None:
    kwargs = _service("gpt-5-mini", stream_usage=False).build_completion_kwargs(
        MESSAGES, stream=True
    )

    assert "stream_options" not in kwargs


def test_reasoning_effort_sent_for_gpt5() -> None:
    kwargs = _service("gpt-5-mini", reasoning_effort="low").build_completion_kwargs(
        MESSAGES, stream=False
    )
    assert kwargs["reasoning_effort"] == "low"


def test_reasoning_effort_never_sent_to_a_non_reasoning_model() -> None:
    """A GPT-4 deployment rejects the parameter, so the model name gates it."""
    kwargs = _service("gpt-4o-mini", reasoning_effort="low").build_completion_kwargs(
        MESSAGES, stream=False
    )
    assert "reasoning_effort" not in kwargs


def test_reasoning_effort_omitted_when_blank() -> None:
    kwargs = _service("gpt-5-mini", reasoning_effort="").build_completion_kwargs(
        MESSAGES, stream=False
    )
    assert "reasoning_effort" not in kwargs


@pytest.mark.parametrize("effort", ["minimal", "low", "medium", "high"])
def test_all_documented_efforts_are_accepted(effort: str) -> None:
    kwargs = _service("gpt-5-mini", reasoning_effort=effort).build_completion_kwargs(
        MESSAGES, stream=False
    )
    assert kwargs["reasoning_effort"] == effort


@pytest.mark.parametrize("effort", ["  LOW  ", "Medium"])
def test_reasoning_effort_is_normalised(effort: str) -> None:
    kwargs = _service("gpt-5-mini", reasoning_effort=effort).build_completion_kwargs(
        MESSAGES, stream=False
    )
    assert kwargs["reasoning_effort"] == effort.strip().lower()


def test_unrecognised_reasoning_effort_is_dropped_not_sent() -> None:
    """A typo in an env var must degrade to the service default rather than
    400 every request in production."""
    kwargs = _service("gpt-5-mini", reasoning_effort="lowest").build_completion_kwargs(
        MESSAGES, stream=False
    )
    assert "reasoning_effort" not in kwargs


def test_tools_included_only_when_provided() -> None:
    service = _service("gpt-5-mini")
    tool = [{"type": "function", "function": {"name": "t"}}]

    assert "tools" not in service.build_completion_kwargs(MESSAGES, stream=True)
    assert service.build_completion_kwargs(MESSAGES, stream=True, tools=tool)["tools"] == tool


@pytest.mark.asyncio
async def test_stream_sends_the_built_kwargs_to_the_api() -> None:
    """Guards against the kwargs builder being bypassed by a future edit.

    Targets `stream` because that is a live code path - the non-streaming
    `chat()` helper it used to cover was never called outside this test.
    """
    service = _service("gpt-5-mini", max_output_tokens=256)

    async def empty_stream():  # type: ignore[no-untyped-def]
        return
        yield  # pragma: no cover - makes this an async generator

    with patch.object(
        service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = empty_stream()
        async for _ in service.stream(
            system_prompt="s", messages=[{"role": "user", "content": "hi"}]
        ):
            pass

    sent = mock_create.call_args.kwargs
    assert "temperature" not in sent
    assert sent["max_completion_tokens"] == 256
    assert sent["stream"] is True


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


@pytest.mark.asyncio
async def test_stream_with_tools_reports_token_usage(llm_service: LLMService) -> None:
    """Token counts arrive on a final choice-less chunk; they feed cost logging."""

    async def mock_stream():
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].delta.content = "hi"
        chunk.choices[0].delta.tool_calls = None
        chunk.choices[0].finish_reason = "stop"
        chunk.usage = None
        yield chunk

        final = MagicMock()
        final.choices = []
        final.usage.prompt_tokens = 100
        final.usage.completion_tokens = 20
        final.usage.total_tokens = 120
        yield final

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_stream()

        from app.tools import ToolRegistry

        events = [
            event
            async for event in llm_service.stream_with_tools(
                system_prompt="Test",
                messages=[{"role": "user", "content": "Hi"}],
                tool_definitions=[],
                tool_registry=ToolRegistry(),
            )
        ]

    usage_events = [e for e in events if e["type"] == "usage"]
    assert usage_events == [
        {"type": "usage", "prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}
    ]
    assert events[-1]["type"] == "usage", "usage must come last, after the content"


@pytest.mark.asyncio
async def test_stream_with_tools_omits_usage_when_provider_sends_none(
    llm_service: LLMService,
) -> None:
    async def mock_stream():
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].delta.content = "hi"
        chunk.choices[0].delta.tool_calls = None
        chunk.choices[0].finish_reason = "stop"
        chunk.usage = None
        yield chunk

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_stream()

        from app.tools import ToolRegistry

        events = [
            event
            async for event in llm_service.stream_with_tools(
                system_prompt="Test",
                messages=[{"role": "user", "content": "Hi"}],
                tool_definitions=[],
                tool_registry=ToolRegistry(),
            )
        ]

    assert not [e for e in events if e["type"] == "usage"]
