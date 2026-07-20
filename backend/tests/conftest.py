from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.routers.chat import init_chat_dependencies


@pytest.fixture
def client() -> TestClient:
    app = create_app()

    mock_retriever = AsyncMock()
    mock_retriever.retrieve.return_value = ("", [])
    mock_llm = AsyncMock()

    async def mock_stream(*args, **kwargs):
        yield "test response"

    mock_llm.stream = mock_stream
    init_chat_dependencies(retriever=mock_retriever, llm_service=mock_llm, tool_registry=None)

    return TestClient(app)
