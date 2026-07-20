from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import get_settings
from app.logging_config import setup_logging
from app.rag.chunker import chunk_github_repos, load_all_knowledge
from app.services.github_api import GitHubAPIService
from app.rag.embeddings import EmbeddingService
from app.rag.retriever import Retriever
from app.rag.store import ChromaStore
from app.routers import chat, health, knowledge
from app.routers.chat import init_chat_dependencies
from app.services.llm import LLMService
from app.tools import ToolRegistry
from app.tools.action_tools import create_action_tools
from app.tools.github_tools import create_github_tools
from app.tools.portfolio_tools import create_portfolio_tools

limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    setup_logging(settings.log_level)
    logger = structlog.get_logger()

    await logger.ainfo("Starting AI Professional Twin backend")

    embedding_service = EmbeddingService(
        api_key=settings.github_token,
        base_url=settings.github_models_base_url,
        model=settings.embedding_model,
    )

    store = ChromaStore(
        persist_dir=settings.chroma_persist_dir,
        collection_name="knowledge",
    )

    store.reset()
    await logger.ainfo("Knowledge base reset, ingesting documents")
    knowledge_dir = Path(__file__).parent.parent / "knowledge"
    docs = load_all_knowledge(knowledge_dir)
    if docs:
        texts = [d.text for d in docs]
        embeddings = await embedding_service.embed_texts(texts)
        for doc, emb in zip(docs, embeddings, strict=True):
            doc.embedding = emb
        store.add_documents(docs)
        await logger.ainfo("Ingested documents", count=len(docs))

    github_service = GitHubAPIService(
        token=settings.github_token,
        username=settings.github_username,
    )
    repos = await github_service.fetch_repos(per_page=30)
    if repos:
        readmes: dict[str, str] = {}
        for repo in repos:
            readme = await github_service.fetch_readme(repo["name"])
            if readme:
                readmes[repo["name"]] = readme
        github_docs = chunk_github_repos(repos, readmes)
        if github_docs:
            gh_texts = [d.text for d in github_docs]
            gh_embeddings = await embedding_service.embed_texts(gh_texts)
            for doc, emb in zip(github_docs, gh_embeddings, strict=True):
                doc.embedding = emb
            store.add_documents(github_docs)
            await logger.ainfo(
                "Ingested GitHub repos",
                count=len(github_docs),
                with_readme=len(readmes),
            )

    retriever = Retriever(
        store=store,
        embedding_service=embedding_service,
    )

    llm_service = LLMService(
        api_key=settings.github_token,
        base_url=settings.github_models_base_url,
        model=settings.llm_model,
    )

    api_base_url = settings.cors_origins[0] if settings.cors_origins else ""
    registry = ToolRegistry()
    for name, func in create_github_tools(github_service).items():
        registry.register(name, func)
    for name, func in create_portfolio_tools(knowledge_dir).items():
        registry.register(name, func)
    for name, func in create_action_tools(api_base_url).items():
        registry.register(name, func)
    await logger.ainfo("Registered tools", count=len(registry.tools))

    init_chat_dependencies(
        retriever=retriever, llm_service=llm_service, tool_registry=registry
    )

    yield

    await logger.ainfo("Shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AI Professional Twin",
        version="0.3.0",
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
