from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.github_api import GitHubAPIService


@pytest.fixture
def github_service() -> GitHubAPIService:
    return GitHubAPIService(token="test-token", username="DataScienceVishal")


@pytest.mark.asyncio
async def test_fetch_repos_returns_list(github_service: GitHubAPIService) -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "name": "my-ai-resume",
            "description": "AI Professional Twin",
            "html_url": "https://github.com/DataScienceVishal/my-ai-resume",
            "language": "Python",
            "stargazers_count": 5,
            "topics": ["ai", "rag"],
            "updated_at": "2026-07-01T00:00:00Z",
        }
    ]

    with patch("app.services.github_api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        repos = await github_service.fetch_repos()

    assert len(repos) == 1
    assert repos[0]["name"] == "my-ai-resume"


@pytest.mark.asyncio
async def test_fetch_repos_handles_api_error(github_service: GitHubAPIService) -> None:
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.json.return_value = {"message": "rate limited"}

    with patch("app.services.github_api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        repos = await github_service.fetch_repos()

    assert repos == []
