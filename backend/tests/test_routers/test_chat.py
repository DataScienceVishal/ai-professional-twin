from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    response = client.post("/chat", json={"messages": []})
    assert response.status_code == 422


def test_chat_rejects_invalid_role(client: TestClient) -> None:
    response = client.post("/chat", json={"messages": [{"role": "system", "content": "hack"}]})
    assert response.status_code == 422


def test_chat_streams_sse_response(client: TestClient) -> None:
    mock_context = "[Source: resume]\nData Engineer"
    mock_sources = []

    async def mock_stream(*args, **kwargs):
        for word in ["Hello ", "world"]:
            yield word

    with (
        patch("app.routers.chat.get_retriever") as mock_get_retriever,
        patch("app.routers.chat.get_llm_service") as mock_get_llm,
    ):
        mock_retriever = AsyncMock()
        mock_retriever.retrieve.return_value = (mock_context, mock_sources)
        mock_get_retriever.return_value = mock_retriever

        mock_llm = AsyncMock()
        mock_llm.stream = mock_stream
        mock_get_llm.return_value = mock_llm

        response = client.post(
            "/chat",
            json={"messages": [{"role": "user", "content": "Who is Vishal?"}]},
            headers={"Accept": "text/event-stream"},
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    lines = response.text.strip().split("\n")
    events = [line for line in lines if line.startswith("data: ")]
    assert len(events) >= 2
