from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.embeddings import EmbeddingService


@pytest.fixture
def embedding_service() -> EmbeddingService:
    return EmbeddingService(
        api_key="test-key",
        model="text-embedding-3-small",
        azure_endpoint="https://example.openai.azure.com",
        api_version="2024-10-21",
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


@pytest.mark.asyncio
async def test_embed_texts_batches_large_inputs(embedding_service: EmbeddingService) -> None:
    """A full re-ingest must not post every document in one oversized request."""

    async def fake_create(model: str, input: list[str]) -> MagicMock:
        response = MagicMock()
        response.data = [MagicMock(embedding=[0.1] * 4) for _ in input]
        return response

    with patch.object(
        embedding_service.client.embeddings, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.side_effect = fake_create
        result = await embedding_service.embed_texts([f"t{i}" for i in range(150)], batch_size=64)

    assert len(result) == 150
    assert mock_create.call_count == 3
    assert [len(call.kwargs["input"]) for call in mock_create.call_args_list] == [64, 64, 22]


@pytest.mark.asyncio
async def test_embed_texts_makes_no_call_for_empty_input(
    embedding_service: EmbeddingService,
) -> None:
    with patch.object(
        embedding_service.client.embeddings, "create", new_callable=AsyncMock
    ) as mock_create:
        result = await embedding_service.embed_texts([])

    assert result == []
    mock_create.assert_not_called()
