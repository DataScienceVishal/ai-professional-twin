import asyncio
import contextlib
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app import __version__
from app.config import Settings, get_settings
from app.ingest import IngestionState, run_ingestion
from app.logging_config import setup_logging
from app.rag.embeddings import EmbeddingService
from app.rag.retriever import Retriever
from app.rag.store import ChromaStore
from app.rate_limit import DailyChatBudget, limiter
from app.routers import chat, health, knowledge
from app.routers.chat import init_chat_dependencies
from app.services.github_api import GitHubAPIService
from app.services.llm import LLMService
from app.tools import ToolRegistry
from app.tools.action_tools import create_action_tools
from app.tools.github_tools import create_github_tools
from app.tools.portfolio_tools import create_portfolio_tools

KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"


def _build_tool_registry(
    settings: Settings,
    github_service: GitHubAPIService,
) -> ToolRegistry:
    registry = ToolRegistry()
    for name, func in create_github_tools(github_service).items():
        registry.register(name, func)
    for name, func in create_portfolio_tools(KNOWLEDGE_DIR).items():
        registry.register(name, func)
    # The action tools build links back into THIS api (e.g. /resume/download),
    # so they need the api's own public origin, not the frontend's.
    for name, func in create_action_tools(settings.public_base_url).items():
        registry.register(name, func)
    return registry


def _log_ingestion_outcome(task: "asyncio.Task[None]") -> None:
    """Surface a crashed ingestion task instead of letting it die silently."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        structlog.get_logger().error("Ingestion task crashed", exc_info=exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    setup_logging(settings.log_level)
    logger = structlog.get_logger()

    await logger.ainfo("Starting backend", version=__version__)

    store = ChromaStore(
        persist_dir=settings.chroma_persist_dir,
        collection_name="knowledge",
    )
    state = IngestionState()
    app.state.store = store
    app.state.ingestion = state

    api_key = settings.azure_openai_api_key or settings.github_token
    if not api_key:
        # Nothing can be embedded or generated without credentials. Stay up and
        # keep serving /health and the static endpoints so the misconfiguration
        # is diagnosable from /ready, instead of crash-looping the container.
        state.error = "MissingCredentials"
        await logger.aerror(
            "No model credentials configured, chat disabled",
            hint="set AZURE_OPENAI_API_KEY",
        )
        yield
        await logger.ainfo("Shutting down")
        return

    embedding_service = EmbeddingService(
        api_key=api_key,
        model=settings.embedding_model,
        azure_endpoint=settings.azure_openai_endpoint or None,
        api_version=settings.azure_openai_api_version if settings.azure_openai_endpoint else None,
    )

    github_service = GitHubAPIService(
        token=settings.github_token,
        username=settings.github_username,
    )

    llm_service = LLMService(
        api_key=api_key,
        model=settings.llm_model,
        azure_endpoint=settings.azure_openai_endpoint or None,
        api_version=settings.azure_openai_api_version if settings.azure_openai_endpoint else None,
        temperature=settings.llm_temperature,
        max_output_tokens=settings.llm_max_output_tokens,
        send_temperature=settings.llm_send_temperature,
        stream_usage=settings.llm_stream_usage,
    )

    registry = _build_tool_registry(settings, github_service)
    await logger.ainfo("Registered tools", count=len(registry.tools))

    init_chat_dependencies(
        app,
        retriever=Retriever(store=store, embedding_service=embedding_service),
        llm_service=llm_service,
        tool_registry=registry,
        budget=DailyChatBudget(settings.daily_chat_budget),
    )

    # Ingestion runs in the background so /health answers immediately. The task
    # is held on app.state so it is not garbage collected mid-flight.
    task = asyncio.create_task(
        run_ingestion(
            store=store,
            embedding_service=embedding_service,
            github_service=github_service,
            settings=settings,
            knowledge_dir=KNOWLEDGE_DIR,
            state=state,
        ),
        name="knowledge-ingestion",
    )
    task.add_done_callback(_log_ingestion_outcome)
    app.state.ingestion_task = task

    yield

    task.cancel()
    # The done-callback has already logged any failure; a crashed ingestion must
    # not also turn shutdown into an error.
    with contextlib.suppress(asyncio.CancelledError, Exception):
        await task
    await logger.ainfo("Shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Professional Profile Assistant",
        version=__version__,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
        )

    app.include_router(health.router)
    app.include_router(chat.router)
    app.include_router(knowledge.router)

    return app
