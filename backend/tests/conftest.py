from collections.abc import AsyncGenerator, Iterator
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings
from app.ingest import IngestionState
from app.logging_config import setup_logging
from app.main import create_app
from app.rate_limit import DailyChatBudget, limiter
from app.routers.chat import init_chat_dependencies


@pytest.fixture(autouse=True, scope="session")
def _configure_logging() -> None:
    """Bind the real structlog config for every test.

    Without this the app runs against structlog's default bound logger, which
    has a *different* set of async methods than the stdlib one used in
    production - so a typo like `awarn` (stdlib has `awarning`) passes the
    tests and then raises AttributeError on Railway.
    """
    setup_logging("info")


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    """get_settings is lru_cached, so env changes must not leak between tests."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> Iterator[None]:
    """The limiter is module-level; without this, counters bleed across tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def app() -> FastAPI:
    """An app wired with mocked dependencies, as if ingestion had finished."""
    fastapi_app = create_app()

    mock_retriever = AsyncMock()
    mock_retriever.retrieve.return_value = ("", [])
    mock_llm = AsyncMock()

    async def mock_stream(*args: object, **kwargs: object) -> AsyncGenerator[str]:
        yield "test response"

    mock_llm.stream = mock_stream

    init_chat_dependencies(
        fastapi_app,
        retriever=mock_retriever,
        llm_service=mock_llm,
        tool_registry=None,
        budget=DailyChatBudget(max_per_day=100),
    )
    fastapi_app.state.ingestion = IngestionState(completed=True)
    return fastapi_app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)
