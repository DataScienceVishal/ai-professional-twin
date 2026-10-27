import json
import time
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.analytics import (
    OUTCOME_ERROR,
    OUTCOME_OK,
    OUTCOME_REFUSED,
    QueryAnalytics,
    QueryRecord,
)
from app.models.chat import ChatRequest, Message
from app.prompts.system import build_system_prompt
from app.rag.retriever import Retriever
from app.rate_limit import DailyChatBudget, chat_rate_limit, limiter
from app.services.llm import LLMService
from app.tools import ToolRegistry
from app.tools.schemas import TOOL_DEFINITIONS

router = APIRouter()
logger = structlog.get_logger()

# One greppable event name per chat request, so the container logs can be
# filtered down to "what are recruiters actually asking".
CHAT_QUERY_EVENT = "chat_query"

NOT_READY_MESSAGE = (
    "The assistant is still starting up and indexing its knowledge base. "
    "Please try again in a few seconds."
)
STREAM_ERROR_MESSAGE = (
    "Sorry, something went wrong while generating that answer. Please try again in a moment."
)
# The page follows this refusal with its own email line, keyed by the code
# below, so the message stops at the retry advice instead of offering contact twice.
BUDGET_EXHAUSTED_MESSAGE = (
    "This assistant has reached its daily usage limit. Please try again tomorrow."
)
# Sent with the budget refusal so the page can offer email without reading the
# wording: on the wire the refusal is otherwise shaped like any failed answer.
BUDGET_EXHAUSTED_CODE = "budget_exhausted"

# The model sees at most the last six turns of the conversation the client
# replays, a turn being one question and the answer to it, and at most
# MAX_HISTORY_BYTES of their text. Six questions at their 2,000-character limit
# and five answers at the default 1,024-token output cap (about 4,000 bytes
# each) come to about 32,000 bytes, so the cap leaves real conversations alone
# and cuts a forged one of 50 messages, each up to 16,000 characters. It counts
# UTF-8 bytes because a token is never shorter than a byte, so it bounds tokens
# too; a count of characters would not.
MAX_HISTORY_TURNS = 6
MAX_HISTORY_BYTES = 32_000


def trim_history(messages: list[Message]) -> list[Message]:
    """The part of the replayed conversation that goes to the model, oldest first.

    Whole turns go from the oldest end, and the turn in progress always stays.
    """
    turns: list[list[Message]] = []
    for message in messages:
        if message.role == "user" or not turns:
            turns.append([message])
        else:
            turns[-1].append(message)
    kept = turns[-MAX_HISTORY_TURNS:]
    size = sum(_byte_length(m.content) for turn in kept for m in turn)
    while len(kept) > 1 and size > MAX_HISTORY_BYTES:
        size -= sum(_byte_length(m.content) for m in kept.pop(0))
    return [message for turn in kept for message in turn]


def _byte_length(text: str) -> int:
    # JSON can carry a lone surrogate, which a plain encode() rejects.
    return len(text.encode("utf-8", "surrogatepass"))


def init_chat_dependencies(
    app: FastAPI,
    retriever: Retriever,
    llm_service: LLMService,
    tool_registry: ToolRegistry | None = None,
    budget: DailyChatBudget | None = None,
    analytics: QueryAnalytics | None = None,
) -> None:
    """Attach chat dependencies to app.state.

    On app.state rather than module globals so a half-initialised app fails
    with a clear 503 instead of an `assert` (which `python -O` strips) or an
    opaque 500.
    """
    app.state.retriever = retriever
    app.state.llm_service = llm_service
    app.state.tool_registry = tool_registry
    app.state.chat_budget = budget
    app.state.query_analytics = analytics


def get_retriever(request: Request) -> Retriever:
    retriever: Retriever | None = getattr(request.app.state, "retriever", None)
    if retriever is None:
        raise HTTPException(status_code=503, detail=NOT_READY_MESSAGE)
    return retriever


def get_llm_service(request: Request) -> LLMService:
    llm_service: LLMService | None = getattr(request.app.state, "llm_service", None)
    if llm_service is None:
        raise HTTPException(status_code=503, detail=NOT_READY_MESSAGE)
    return llm_service


def get_tool_registry(request: Request) -> ToolRegistry | None:
    registry: ToolRegistry | None = getattr(request.app.state, "tool_registry", None)
    return registry


def get_chat_budget(request: Request) -> DailyChatBudget | None:
    budget: DailyChatBudget | None = getattr(request.app.state, "chat_budget", None)
    return budget


def get_query_analytics(request: Request) -> QueryAnalytics | None:
    """None when nothing wired it up, in which case chat simply logs and moves on."""
    analytics: QueryAnalytics | None = getattr(request.app.state, "query_analytics", None)
    return analytics


def _sse(payload: dict[str, Any]) -> dict[str, str]:
    return {"data": json.dumps(payload)}


async def _refusal_stream(message: str, code: str) -> AsyncGenerator[dict[str, str]]:
    yield _sse({"type": "error", "message": message, "code": code})
    yield _sse({"type": "done"})


@router.post("/chat")
@limiter.limit(chat_rate_limit)
async def chat(
    request: Request,
    payload: ChatRequest,
    retriever: Retriever = Depends(get_retriever),
    llm: LLMService = Depends(get_llm_service),
    tool_registry: ToolRegistry | None = Depends(get_tool_registry),
    budget: DailyChatBudget | None = Depends(get_chat_budget),
    analytics: QueryAnalytics | None = Depends(get_query_analytics),
) -> EventSourceResponse:
    last_message = payload.messages[-1].content
    mode = payload.mode.value
    history = [m.content for m in payload.messages[:-1] if m.role == "user"]

    if budget is not None and not budget.try_consume():
        await logger.awarning(
            CHAT_QUERY_EVENT,
            query=last_message,
            mode=mode,
            outcome=OUTCOME_REFUSED,
            budget_remaining=0,
        )
        if analytics is not None:
            await analytics.record(
                QueryRecord(query=last_message, mode=mode, outcome=OUTCOME_REFUSED)
            )
        return EventSourceResponse(_refusal_stream(BUDGET_EXHAUSTED_MESSAGE, BUDGET_EXHAUSTED_CODE))

    async def event_stream() -> AsyncGenerator[dict[str, str]]:
        started = time.perf_counter()
        tools_used: list[str] = []
        usage: dict[str, Any] = {}
        retrieved_chunks = 0
        has_context = False
        outcome = OUTCOME_OK

        try:
            rag_context, sources = await retriever.retrieve(last_message, history=history)
            retrieved_chunks = len(sources)
            has_context = bool(rag_context.strip())
            system_prompt = build_system_prompt(mode=payload.mode, rag_context=rag_context)
            messages = [
                {"role": m.role, "content": m.content} for m in trim_history(payload.messages)
            ]

            if tool_registry is not None and tool_registry.tools:
                async for event in llm.stream_with_tools(
                    system_prompt=system_prompt,
                    messages=messages,
                    tool_definitions=TOOL_DEFINITIONS,
                    tool_registry=tool_registry,
                ):
                    if event["type"] == "usage":
                        usage = {k: v for k, v in event.items() if k != "type"}
                        continue
                    if event["type"] == "tool_start":
                        tools_used.append(str(event["tool"]))
                    yield _sse(event)
            else:
                async for chunk in llm.stream(system_prompt=system_prompt, messages=messages):
                    yield _sse({"type": "chunk", "content": chunk})

            # Emit every source, not just the ones with a URL. Recruiter answers
            # are grounded in career_qa.yaml and linkedin.yaml, which carry no
            # per-entry link, so filtering on `url` stripped the citations from
            # exactly the answers a recruiter is reading. The frontend renders
            # url-less sources as plain chips.
            #
            # Linkable sources (GitHub repos, certificates, LinkedIn) are
            # externally verifiable and carry far more weight with a reader than
            # a chip pointing at an internal YAML file, so surface them first.
            # sorted() is stable, so relevance order holds within each group.
            ordered = sorted(sources, key=lambda s: not s.url)
            source_data = [{"source": s.source, "detail": s.detail, "url": s.url} for s in ordered]
            yield _sse({"type": "sources", "sources": source_data})
        except Exception as exc:
            # Azure can fail mid-stream (rate limit, content filter, auth). Log
            # the detail server-side and hand the client a safe message rather
            # than dropping the connection with nothing rendered.
            outcome = OUTCOME_ERROR
            await logger.aerror(
                "chat_stream_failed",
                exc_info=exc,
                error_type=type(exc).__name__,
                mode=mode,
                tools_used=tools_used,
            )
            yield _sse({"type": "error", "message": STREAM_ERROR_MESSAGE})

        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        await logger.ainfo(
            CHAT_QUERY_EVENT,
            query=last_message,
            mode=mode,
            message_count=len(payload.messages),
            retrieved_chunks=retrieved_chunks,
            has_context=has_context,
            tools_used=tools_used,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
            outcome=outcome,
            latency_ms=latency_ms,
            budget_remaining=budget.remaining if budget is not None else None,
        )
        # Same fields, but persisted so they can actually be aggregated later.
        # QueryAnalytics.record swallows its own IO errors, so this cannot turn
        # a served answer into a failed request.
        if analytics is not None:
            await analytics.record(
                QueryRecord(
                    query=last_message,
                    mode=mode,
                    outcome=outcome,
                    retrieved_chunks=retrieved_chunks,
                    has_context=has_context,
                    tools_used=tools_used,
                    latency_ms=latency_ms,
                    prompt_tokens=usage.get("prompt_tokens"),
                    completion_tokens=usage.get("completion_tokens"),
                    total_tokens=usage.get("total_tokens"),
                )
            )
        yield _sse({"type": "done"})

    return EventSourceResponse(event_stream())
