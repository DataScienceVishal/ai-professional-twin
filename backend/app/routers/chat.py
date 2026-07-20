import json
from collections.abc import AsyncGenerator

import structlog
from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.models.chat import ChatRequest
from app.prompts.system import build_system_prompt
from app.rag.retriever import Retriever
from app.services.llm import LLMService
from app.tools import ToolRegistry
from app.tools.schemas import TOOL_DEFINITIONS

router = APIRouter()
logger = structlog.get_logger()

_retriever: Retriever | None = None
_llm_service: LLMService | None = None
_tool_registry: ToolRegistry | None = None


def init_chat_dependencies(
    retriever: Retriever,
    llm_service: LLMService,
    tool_registry: ToolRegistry | None = None,
) -> None:
    global _retriever, _llm_service, _tool_registry
    _retriever = retriever
    _llm_service = llm_service
    _tool_registry = tool_registry


def get_retriever() -> Retriever:
    assert _retriever is not None
    return _retriever


def get_llm_service() -> LLMService:
    assert _llm_service is not None
    return _llm_service


def get_tool_registry() -> ToolRegistry | None:
    return _tool_registry


@router.post("/chat")
async def chat(
    request: ChatRequest,
    retriever: Retriever = Depends(get_retriever),
    llm: LLMService = Depends(get_llm_service),
    tool_registry: ToolRegistry | None = Depends(get_tool_registry),
) -> EventSourceResponse:
    last_message = request.messages[-1].content
    await logger.ainfo("Chat request", query=last_message, mode=request.mode.value)

    rag_context, sources = await retriever.retrieve(last_message)
    system_prompt = build_system_prompt(mode=request.mode, rag_context=rag_context)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def event_stream() -> AsyncGenerator[dict[str, str]]:
        if tool_registry is not None and tool_registry.tools:
            async for event in llm.stream_with_tools(
                system_prompt=system_prompt,
                messages=messages,
                tool_definitions=TOOL_DEFINITIONS,
                tool_registry=tool_registry,
            ):
                yield {"data": json.dumps(event)}
        else:
            async for chunk in llm.stream(system_prompt=system_prompt, messages=messages):
                yield {"data": json.dumps({"type": "chunk", "content": chunk})}

        source_data = [
            {"source": s.source, "detail": s.detail, "url": s.url}
            for s in sources
            if s.url
        ]
        yield {"data": json.dumps({"type": "sources", "sources": source_data})}
        yield {"data": json.dumps({"type": "done"})}

    return EventSourceResponse(event_stream())
