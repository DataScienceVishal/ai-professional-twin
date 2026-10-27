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
            "description": "Professional profile assistant",
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
async def test_fetch_repos_surfaces_the_ingestion_quality_fields(
    github_service: GitHubAPIService,
) -> None:
    """fork and archived drive the ingestion filters, so they must be passed through."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "name": "someone-elses-lib",
            # The live API sends null, not "", for a repo with no description.
            "description": None,
            "html_url": "https://github.com/DataScienceVishal/someone-elses-lib",
            "language": None,
            "topics": None,
            "fork": True,
            "archived": True,
        }
    ]

    with patch("app.services.github_api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        repos = await github_service.fetch_repos()

    assert repos[0]["fork"] is True
    assert repos[0]["archived"] is True
    assert repos[0]["description"] == ""
    assert repos[0]["language"] == ""
    assert repos[0]["topics"] == []


@pytest.mark.asyncio
async def test_fetch_repos_defaults_the_quality_fields_when_absent(
    github_service: GitHubAPIService,
) -> None:
    """A missing flag must never silently drop a real repo from ingestion."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"name": "repo-1", "html_url": "https://github.com/DataScienceVishal/repo-1"}
    ]

    with patch("app.services.github_api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        repos = await github_service.fetch_repos()

    assert repos[0]["fork"] is False
    assert repos[0]["archived"] is False


@pytest.mark.asyncio
async def test_fetch_repos_passes_through_forks_and_dates(github_service: GitHubAPIService) -> None:
    """The GitHub tools report these, so they come from the same list call."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "name": "ai-professional-twin",
            "html_url": "https://github.com/DataScienceVishal/ai-professional-twin",
            "forks_count": 2,
            "created_at": "2026-07-11T02:39:55Z",
            "updated_at": "2026-10-27T12:24:59Z",
            "pushed_at": "2026-10-27T12:24:51Z",
        },
        {"name": "repo-1", "html_url": "https://github.com/DataScienceVishal/repo-1"},
    ]

    with patch("app.services.github_api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        repos = await github_service.fetch_repos()

    assert repos[0]["forks_count"] == 2
    assert repos[0]["created_at"] == "2026-07-11T02:39:55Z"
    assert repos[0]["pushed_at"] == "2026-10-27T12:24:51Z"
    assert repos[1]["forks_count"] == 0
    assert repos[1]["created_at"] == ""
    assert repos[1]["pushed_at"] == ""


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
