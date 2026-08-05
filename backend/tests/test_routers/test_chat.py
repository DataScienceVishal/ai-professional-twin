import json
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from app.analytics import OUTCOME_REFUSED, QueryAnalytics
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
    analytics: QueryAnalytics | None = None,
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
        analytics=analytics,
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


def test_sources_without_a_url_are_still_emitted() -> None:
    """Recruiter answers are grounded in career_qa/linkedin, which carry no
    per-entry link. Filtering on `url` stripped citations from exactly the
    answers a recruiter reads."""
    retrieve = AsyncMock(
        return_value=("ctx", [SourceInfo(source="career_qa", detail="sponsorship", url="")])
    )
    client = TestClient(_build_app(retrieve=retrieve))

    response = client.post("/chat", json=PAYLOAD, headers={"Accept": "text/event-stream"})

    sources = next(e for e in _events(response) if e["type"] == "sources")["sources"]
    assert [s["source"] for s in sources] == ["career_qa"]


def test_linkable_sources_are_listed_first() -> None:
    """Externally verifiable sources carry more weight than a chip pointing at
    an internal YAML file, so they lead. Ordering is stable within each group."""
    retrieve = AsyncMock(
        return_value=(
            "ctx",
            [
                SourceInfo(source="career_qa", detail="hiring", url=""),
                SourceInfo(source="github", detail="repo-a", url="https://example.com/a"),
                SourceInfo(source="skills", detail="python", url=""),
                SourceInfo(source="projects", detail="repo-b", url="https://example.com/b"),
            ],
        )
    )
    client = TestClient(_build_app(retrieve=retrieve))

    response = client.post("/chat", json=PAYLOAD, headers={"Accept": "text/event-stream"})

    sources = next(e for e in _events(response) if e["type"] == "sources")["sources"]
    assert [s["source"] for s in sources] == ["github", "projects", "career_qa", "skills"]


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


def test_chat_accepts_a_follow_up_after_a_long_answer() -> None:
    """Regression: the second turn of any conversation used to 422.

    The client replays the whole thread, so an Interview-mode answer comes back
    as an `assistant` message far longer than anything a visitor would type.
    """
    long_answer = "### Architecture\n\n" + "The retrieval pipeline. " * 200
    client = TestClient(_build_app())

    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "How does the retrieval pipeline work?"},
                {"role": "assistant", "content": long_answer},
                {"role": "user", "content": "How is it evaluated?"},
            ],
            "mode": "interview",
        },
    )

    assert response.status_code == 200
    assert [e["type"] for e in _events(response)] == ["chunk", "sources", "done"]


def test_chat_still_rejects_an_oversized_user_turn() -> None:
    client = TestClient(_build_app())

    response = client.post("/chat", json={"messages": [{"role": "user", "content": "x" * 2001}]})

    assert response.status_code == 422


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


def _persisted(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def test_chat_persists_one_analytics_line_per_request(tmp_path: Path) -> None:
    """Railway logs scroll away; the JSONL file is what survives to be counted."""
    path = tmp_path / "analytics" / "queries.jsonl"
    retrieve = AsyncMock(
        return_value=(
            "[Source: resume]\nData Engineer",
            [SourceInfo(source="resume", detail="page 1", url="")],
        )
    )
    client = TestClient(
        _build_app(retrieve=retrieve, analytics=QueryAnalytics(path=path, max_bytes=1_000_000))
    )

    client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Does he have a visa?"}],
            "mode": "recruiter",
        },
    )
    client.post("/chat", json=PAYLOAD)

    rows = _persisted(path)
    assert len(rows) == 2
    assert rows[0]["query"] == "Does he have a visa?"
    assert rows[0]["mode"] == "recruiter"
    assert rows[0]["retrieved_chunks"] == 1
    assert rows[0]["has_context"] is True
    assert rows[0]["outcome"] == "ok"
    assert rows[1]["query"] == "Who is Vishal?"


def test_persisted_analytics_never_include_the_caller(tmp_path: Path) -> None:
    """Privacy: the question is the signal, not who asked it."""
    path = tmp_path / "queries.jsonl"
    client = TestClient(_build_app(analytics=QueryAnalytics(path=path, max_bytes=1_000_000)))

    client.post("/chat", json=PAYLOAD, headers={"User-Agent": "recruiter-browser/1.0"})

    row = _persisted(path)[0]
    assert not {"ip", "client_ip", "client_host", "user_agent", "session_id"} & set(row)
    assert "recruiter-browser" not in json.dumps(row)


def test_a_budget_refusal_is_persisted_too(tmp_path: Path) -> None:
    path = tmp_path / "queries.jsonl"
    client = TestClient(
        _build_app(
            budget=DailyChatBudget(max_per_day=0),
            analytics=QueryAnalytics(path=path, max_bytes=1_000_000),
        )
    )

    client.post("/chat", json=PAYLOAD)

    assert _persisted(path)[0]["outcome"] == OUTCOME_REFUSED


def test_an_analytics_write_failure_does_not_break_the_chat_request(tmp_path: Path) -> None:
    """A full or read-only volume must cost the visitor nothing."""
    blocker = tmp_path / "blocker"
    blocker.write_text("not a directory")
    client = TestClient(
        _build_app(analytics=QueryAnalytics(path=blocker / "queries.jsonl", max_bytes=1_000_000))
    )

    response = client.post("/chat", json=PAYLOAD)

    assert response.status_code == 200
    assert [e["type"] for e in _events(response)] == ["chunk", "sources", "done"]


def test_chat_works_when_no_analytics_sink_is_wired_up() -> None:
    response = TestClient(_build_app(analytics=None)).post("/chat", json=PAYLOAD)

    assert [e["type"] for e in _events(response)] == ["chunk", "sources", "done"]
