from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.embeddings import EmbeddingService


@pytest.fixture
def embedding_service() -> EmbeddingService:
    return EmbeddingService(
        api_key="test-key",
        base_url="https://models.github.ai/inference",
        model="text-embedding-3-small",
    )


@pytest.mark.asyncio
async def test_embed_single_text(embedding_service: EmbeddingService) -> None:
    mock_embedding = [0.1] * 1536
    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=mock_embedding)]

    with patch.object(
        embedding_service.client.embeddings, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_response
        result = await embedding_service.embed_texts(["hello world"])

    assert len(result) == 1
    assert len(result[0]) == 1536
    mock_create.assert_called_once_with(model="text-embedding-3-small", input=["hello world"])


@pytest.mark.asyncio
async def test_embed_multiple_texts(embedding_service: EmbeddingService) -> None:
    mock_embeddings = [[0.1] * 1536, [0.2] * 1536]
    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=e) for e in mock_embeddings]

    with patch.object(
        embedding_service.client.embeddings, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_response
        result = await embedding_service.embed_texts(["text one", "text two"])

    assert len(result) == 2
