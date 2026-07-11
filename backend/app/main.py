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
from app.rag.chunker import load_all_knowledge
from app.rag.embeddings import EmbeddingService
from app.rag.retriever import Retriever
from app.rag.store import ChromaStore
from app.routers import chat, health, knowledge
from app.routers.chat import init_chat_dependencies
from app.services.llm import LLMService

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

    if store.count() == 0:
        await logger.ainfo("Knowledge base empty, ingesting documents")
        knowledge_dir = Path(__file__).parent.parent / "knowledge"
        docs = load_all_knowledge(knowledge_dir)
        if docs:
            texts = [d.text for d in docs]
            embeddings = await embedding_service.embed_texts(texts)
            for doc, emb in zip(docs, embeddings, strict=True):
                doc.embedding = emb
            store.add_documents(docs)
            await logger.ainfo("Ingested documents", count=len(docs))

    retriever = Retriever(
        store=store,
        embedding_service=embedding_service,
    )

    llm_service = LLMService(
        api_key=settings.github_token,
        base_url=settings.github_models_base_url,
        model=settings.llm_model,
    )

    init_chat_dependencies(retriever=retriever, llm_service=llm_service)

    yield

    await logger.ainfo("Shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AI Professional Twin",
        version="0.2.0",
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
