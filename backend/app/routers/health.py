from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app import __version__

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness only. Railway polls this, so it must stay cheap and dependency-free."""
    return {
        "status": "healthy",
        "version": __version__,
        "service": "backend",
    }


@router.get("/ready")
async def ready(request: Request) -> JSONResponse:
    """Readiness: is there actually a knowledge base to answer from?"""
    state = getattr(request.app.state, "ingestion", None)
    store = getattr(request.app.state, "store", None)

    document_count = 0
    if store is not None:
        try:
            document_count = int(store.count())
        except Exception:
            document_count = 0

    body: dict[str, Any] = {
        "status": "ready" if document_count > 0 else "not_ready",
        "version": __version__,
        "ingestion_complete": bool(getattr(state, "completed", False)),
        "ingestion_error": getattr(state, "error", None),
        "github_skipped": bool(getattr(state, "github_skipped", False)),
        "document_count": document_count,
        "llm_configured": getattr(request.app.state, "llm_service", None) is not None,
    }
    return JSONResponse(status_code=200 if document_count > 0 else 503, content=body)
