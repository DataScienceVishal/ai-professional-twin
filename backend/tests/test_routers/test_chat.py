import json
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from app.main import create_app
from app.rag.retriever import SourceInfo
from app.rate_limit import DailyChatBudget
from app.routers.chat import (
    BUDGET_EXHAUSTED_MESSAGE,
    CHAT_QUERY_EVENT,
    STREAM_ERROR_MESSAGE,
    init_chat_dependencies,
)
from app.tools import ToolRegistry

PAYLOAD = {"messages": [{"role": "user", "content": "Who is Vishal?"}]}


def _events(response: Any) -> list[dict[str, Any]]:
    return [
        json.loads(line.removeprefix("data: "))
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]


def _build_app(
    *,
    stream: Any = None,
    retrieve: Any = None,
    tool_registry: ToolRegistry | None = None,
    budget: DailyChatBudget | None = None,
) -> FastAPI:
    app = create_app()

    async def default_stream(*args: object, **kwargs: object) -> AsyncGenerator[str]:
        yield "hello"

    retriever = AsyncMock()
    retriever.retrieve = retrieve or AsyncMock(return_value=("", []))
    llm = AsyncMock()
    llm.stream = stream or default_stream

    init_chat_dependencies(
        app,
        retriever=retriever,
        llm_service=llm,
        tool_registry=tool_registry,
        budget=budget or DailyChatBudget(max_per_day=100),
    )
    return app


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    response = client.post("/chat", json={"messages": []})
    assert response.status_code == 422


def test_chat_rejects_invalid_role(client: TestClient) -> None:
    response = client.post("/chat", json={"messages": [{"role": "system", "content": "hack"}]})
    assert response.status_code == 422


def test_chat_streams_sse_response() -> None:
    async def stream(*args: object, **kwargs: object) -> AsyncGenerator[str]:
        for word in ["Hello ", "world"]:
            yield word

    retrieve = AsyncMock(
        return_value=(
            "[Source: resume]\nData Engineer",
            [SourceInfo(source="resume", detail="page 1", url="https://example.com")],
        )
    )
    client = TestClient(_build_app(stream=stream, retrieve=retrieve))

    response = client.post("/chat", json=PAYLOAD, headers={"Accept": "text/event-stream"})

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    events = _events(response)
    assert [e["content"] for e in events if e["type"] == "chunk"] == ["Hello ", "world"]
    assert events[-1] == {"type": "done"}
    assert any(e["type"] == "sources" for e in events)


def test_chat_passes_prior_user_turns_as_history() -> None:
    retrieve = AsyncMock(return_value=("", []))
    client = TestClient(_build_app(retrieve=retrieve))

    client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "Tell me about his thesis"},
                {"role": "assistant", "content": "It was about RAG"},
                {"role": "user", "content": "What tools did he use?"},
            ]
        },
    )

    retrieve.assert_awaited_once_with(
        "What tools did he use?", history=["Tell me about his thesis"]
    )


def test_chat_returns_503_when_dependencies_are_missing() -> None:
    """Requests can now arrive before init; that must degrade, not 500."""
    response = TestClient(create_app()).post("/chat", json=PAYLOAD)

    assert response.status_code == 503
    assert "starting up" in response.json()["detail"]


def test_chat_emits_an_error_event_when_the_stream_fails() -> None:
    async def exploding_stream(*args: object, **kwargs: object) -> AsyncGenerator[str]:
        yield "partial"
        raise RuntimeError("azure-key=sk-secret endpoint=https://internal.openai.azure.com")

    client = TestClient(_build_app(stream=exploding_stream))

    response = client.post("/chat", json=PAYLOAD)

    events = _events(response)
    errors = [e for e in events if e["type"] == "error"]
    assert len(errors) == 1
    assert errors[0]["message"] == STREAM_ERROR_MESSAGE
    assert events[-1] == {"type": "done"}


def test_stream_errors_never_leak_secrets_to_the_client() -> None:
    async def exploding_stream(*args: object, **kwargs: object) -> AsyncGenerator[str]:
        raise RuntimeError("api_key=sk-secret-abc123 at https://internal.openai.azure.com")
        yield ""  # pragma: no cover

    response = TestClient(_build_app(stream=exploding_stream)).post("/chat", json=PAYLOAD)

    assert "sk-secret-abc123" not in response.text
    assert "openai.azure.com" not in response.text
    assert "Traceback" not in response.text


def test_chat_emits_an_error_event_when_retrieval_fails() -> None:
    retrieve = AsyncMock(side_effect=RuntimeError("chroma exploded"))

    response = TestClient(_build_app(retrieve=retrieve)).post("/chat", json=PAYLOAD)

    assert response.status_code == 200
    assert [e for e in _events(response) if e["type"] == "error"]


def test_chat_refuses_politely_once_the_daily_budget_is_gone() -> None:
    client = TestClient(_build_app(budget=DailyChatBudget(max_per_day=1)))

    first = client.post("/chat", json=PAYLOAD)
    second = client.post("/chat", json=PAYLOAD)

    assert [e["type"] for e in _events(first)] == ["chunk", "sources", "done"]
    # A friendly message, not a raw 500.
    assert second.status_code == 200
    assert _events(second) == [
        {"type": "error", "message": BUDGET_EXHAUSTED_MESSAGE},
        {"type": "done"},
    ]
    assert "tomorrow" in BUDGET_EXHAUSTED_MESSAGE


def test_budget_refusal_does_not_call_the_model() -> None:
    app = _build_app(budget=DailyChatBudget(max_per_day=0))
    client = TestClient(app)

    client.post("/chat", json=PAYLOAD)

    app.state.retriever.retrieve.assert_not_awaited()


def test_chat_is_rate_limited_per_ip() -> None:
    """Chat costs money, so it gets a tighter limit than the read-only routes."""
    client = TestClient(_build_app())

    statuses = [client.post("/chat", json=PAYLOAD).status_code for _ in range(12)]

    assert statuses[:10] == [200] * 10
    assert 429 in statuses[10:]


def test_read_only_endpoints_keep_the_looser_default_limit() -> None:
    client = TestClient(_build_app())

    statuses = [client.get("/health").status_code for _ in range(12)]

    assert statuses == [200] * 12


def _chat_query_logs(logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [entry for entry in logs if entry.get("event") == CHAT_QUERY_EVENT]


def test_chat_logs_one_analytics_event_per_request() -> None:
    """Item 8: the single most valuable signal, greppable from Railway logs."""
    retrieve = AsyncMock(
        return_value=(
            "[Source: resume]\nData Engineer",
            [SourceInfo(source="resume", detail="page 1", url="https://example.com")],
        )
    )
    client = TestClient(_build_app(retrieve=retrieve))

    with capture_logs() as logs:
        client.post(
            "/chat",
            json={
                "messages": [{"role": "user", "content": "Does he have a visa?"}],
                "mode": "recruiter",
            },
        )

    entries = _chat_query_logs(logs)
    assert len(entries) == 1
    entry = entries[0]
    assert entry["query"] == "Does he have a visa?"
    assert entry["mode"] == "recruiter"
    assert entry["retrieved_chunks"] == 1
    assert entry["has_context"] is True
    assert entry["tools_used"] == []
    assert entry["outcome"] == "ok"
    assert entry["message_count"] == 1
    assert isinstance(entry["latency_ms"], float)
    assert entry["budget_remaining"] == 99


def test_analytics_event_flags_retrieval_that_found_nothing() -> None:
    client = TestClient(_build_app(retrieve=AsyncMock(return_value=("", []))))

    with capture_logs() as logs:
        client.post("/chat", json=PAYLOAD)

    entry = _chat_query_logs(logs)[0]
    assert entry["retrieved_chunks"] == 0
    assert entry["has_context"] is False


def test_analytics_event_records_failures() -> None:
    async def exploding_stream(*args: object, **kwargs: object) -> AsyncGenerator[str]:
        raise RuntimeError("azure down")
        yield ""  # pragma: no cover

    client = TestClient(_build_app(stream=exploding_stream))

    with capture_logs() as logs:
        client.post("/chat", json=PAYLOAD)

    assert _chat_query_logs(logs)[0]["outcome"] == "error"
    assert any(entry.get("event") == "chat_stream_failed" for entry in logs)


def test_analytics_event_records_tools_and_token_usage() -> None:
    async def tool_stream(*args: object, **kwargs: object) -> AsyncGenerator[dict[str, Any]]:
        yield {"type": "tool_start", "tool": "get_resume_download_link", "args": {}}
        yield {"type": "tool_result", "tool": "get_resume_download_link", "summary": "ok"}
        yield {"type": "chunk", "content": "here it is"}
        yield {"type": "usage", "prompt_tokens": 120, "completion_tokens": 30, "total_tokens": 150}

    registry = ToolRegistry()

    async def a_tool() -> str:
        return "ok"

    registry.register("get_resume_download_link", a_tool)

    app = _build_app(tool_registry=registry)
    app.state.llm_service.stream_with_tools = tool_stream

    with capture_logs() as logs:
        response = TestClient(app).post("/chat", json=PAYLOAD)

    entry = _chat_query_logs(logs)[0]
    assert entry["tools_used"] == ["get_resume_download_link"]
    assert entry["prompt_tokens"] == 120
    assert entry["completion_tokens"] == 30
    assert entry["total_tokens"] == 150

    # The usage event is for our logs only; it must not reach the browser.
    assert [e["type"] for e in _events(response)] == [
        "tool_start",
        "tool_result",
        "chunk",
        "sources",
        "done",
    ]
