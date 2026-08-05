import json
import time
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.models.chat import ChatRequest
from app.prompts.system import build_system_prompt
from app.rag.retriever import Retriever
from app.rate_limit import DailyChatBudget, chat_rate_limit, limiter
from app.services.llm import LLMService
from app.tools import ToolRegistry
from app.tools.schemas import TOOL_DEFINITIONS

router = APIRouter()
logger = structlog.get_logger()

# One greppable event name per chat request, so Railway logs can be filtered
# down to "what are recruiters actually asking".
CHAT_QUERY_EVENT = "chat_query"

NOT_READY_MESSAGE = (
    "The assistant is still starting up and indexing its knowledge base. "
    "Please try again in a few seconds."
)
STREAM_ERROR_MESSAGE = (
    "Sorry, something went wrong while generating that answer. Please try again in a moment."
)
BUDGET_EXHAUSTED_MESSAGE = (
    "This assistant has reached its daily usage limit. Please try again "
    "tomorrow, or use the contact link to reach Vishal directly."
)


def init_chat_dependencies(
    app: FastAPI,
    retriever: Retriever,
    llm_service: LLMService,
    tool_registry: ToolRegistry | None = None,
    budget: DailyChatBudget | None = None,
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


def _sse(payload: dict[str, Any]) -> dict[str, str]:
    return {"data": json.dumps(payload)}


async def _refusal_stream(message: str) -> AsyncGenerator[dict[str, str]]:
    yield _sse({"type": "error", "message": message})
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
) -> EventSourceResponse:
    last_message = payload.messages[-1].content
    mode = payload.mode.value
    history = [m.content for m in payload.messages[:-1] if m.role == "user"]

    if budget is not None and not budget.try_consume():
        await logger.awarning(
            CHAT_QUERY_EVENT,
            query=last_message,
            mode=mode,
            outcome="budget_exhausted",
            budget_remaining=0,
        )
        return EventSourceResponse(_refusal_stream(BUDGET_EXHAUSTED_MESSAGE))

    async def event_stream() -> AsyncGenerator[dict[str, str]]:
        started = time.perf_counter()
        tools_used: list[str] = []
        usage: dict[str, Any] = {}
        retrieved_chunks = 0
        has_context = False
        outcome = "ok"

        try:
            rag_context, sources = await retriever.retrieve(last_message, history=history)
            retrieved_chunks = len(sources)
            has_context = bool(rag_context.strip())
            system_prompt = build_system_prompt(mode=payload.mode, rag_context=rag_context)
            messages = [{"role": m.role, "content": m.content} for m in payload.messages]

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
            source_data = [{"source": s.source, "detail": s.detail, "url": s.url} for s in sources]
            yield _sse({"type": "sources", "sources": source_data})
        except Exception as exc:
            # Azure can fail mid-stream (rate limit, content filter, auth). Log
            # the detail server-side and hand the client a safe message rather
            # than dropping the connection with nothing rendered.
            outcome = "error"
            await logger.aerror(
                "chat_stream_failed",
                exc_info=exc,
                error_type=type(exc).__name__,
                mode=mode,
                tools_used=tools_used,
            )
            yield _sse({"type": "error", "message": STREAM_ERROR_MESSAGE})

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
            latency_ms=round((time.perf_counter() - started) * 1000, 1),
            budget_remaining=budget.remaining if budget is not None else None,
        )
        yield _sse({"type": "done"})

    return EventSourceResponse(event_stream())
