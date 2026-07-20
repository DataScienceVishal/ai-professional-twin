import json
from unittest.mock import AsyncMock

import pytest

from app.tools.github_tools import create_github_tools


@pytest.fixture
def mock_github_service() -> AsyncMock:
    service = AsyncMock()
    service.username = "DataScienceVishal"
    service.fetch_repos.return_value = [
        {
            "name": "ai-professional-twin",
            "description": "RAG-powered AI assistant",
            "html_url": "https://github.com/DataScienceVishal/ai-professional-twin",
            "language": "Python",
            "stargazers_count": 5,
            "topics": ["ai", "rag", "fastapi"],
            "updated_at": "2026-07-20T00:00:00Z",
        },
        {
            "name": "chess-analytics",
            "description": "Chess data analysis",
            "html_url": "https://github.com/DataScienceVishal/chess-analytics",
            "language": "Python",
            "stargazers_count": 2,
            "topics": ["data-analysis", "chess"],
            "updated_at": "2026-07-01T00:00:00Z",
        },
    ]
    return service


@pytest.mark.asyncio
async def test_search_repos_by_keyword(mock_github_service: AsyncMock) -> None:
    tools = create_github_tools(mock_github_service)
    result = await tools["search_repos"](query="ai")
    parsed = json.loads(result)
    assert len(parsed["repos"]) == 1
    assert parsed["repos"][0]["name"] == "ai-professional-twin"


@pytest.mark.asyncio
async def test_search_repos_by_language(mock_github_service: AsyncMock) -> None:
    tools = create_github_tools(mock_github_service)
    result = await tools["search_repos"](query="", language="Python")
    parsed = json.loads(result)
    assert len(parsed["repos"]) == 2


@pytest.mark.asyncio
async def test_search_repos_no_match(mock_github_service: AsyncMock) -> None:
    tools = create_github_tools(mock_github_service)
    result = await tools["search_repos"](query="nonexistent")
    parsed = json.loads(result)
    assert len(parsed["repos"]) == 0


@pytest.mark.asyncio
async def test_get_repo_stats(mock_github_service: AsyncMock) -> None:
    tools = create_github_tools(mock_github_service)
    result = await tools["get_repo_stats"](repo_name="ai-professional-twin")
    parsed = json.loads(result)
    assert parsed["name"] == "ai-professional-twin"
    assert parsed["stars"] == 5
    assert parsed["language"] == "Python"


@pytest.mark.asyncio
async def test_get_repo_stats_not_found(mock_github_service: AsyncMock) -> None:
    tools = create_github_tools(mock_github_service)
    result = await tools["get_repo_stats"](repo_name="nonexistent")
    assert "not found" in result.lower()


@pytest.mark.asyncio
async def test_get_recent_activity(mock_github_service: AsyncMock) -> None:
    tools = create_github_tools(mock_github_service)
    result = await tools["get_recent_activity"](days=30)
    parsed = json.loads(result)
    assert len(parsed["recent_repos"]) == 2
