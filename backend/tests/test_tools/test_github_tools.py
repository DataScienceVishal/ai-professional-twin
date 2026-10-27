import json
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.tools.github_tools import REPO_CACHE_TTL, create_github_tools
from app.tools.schemas import TOOL_DEFINITIONS

NOW = datetime(2026, 10, 27, 12, 0, tzinfo=UTC)

TWIN: dict[str, Any] = {
    "name": "ai-professional-twin",
    "description": "RAG-powered AI assistant",
    "html_url": "https://github.com/DataScienceVishal/ai-professional-twin",
    "language": "Python",
    "stargazers_count": 5,
    "forks_count": 1,
    "topics": ["ai", "rag", "fastapi"],
    "created_at": "2026-07-11T00:00:00Z",
    "updated_at": "2026-10-27T09:30:00Z",
    "pushed_at": "2026-10-27T09:00:00Z",
    "fork": False,
    "archived": False,
}

# Updated in October but last pushed in July, so a window on the update time
# and a window on the push time disagree about it.
CHESS: dict[str, Any] = {
    "name": "chess-analytics",
    "description": "Chess data analysis",
    "html_url": "https://github.com/DataScienceVishal/chess-analytics",
    "language": "Python",
    "stargazers_count": 2,
    "forks_count": 0,
    "topics": ["data-analysis", "chess"],
    "created_at": "2026-06-01T00:00:00Z",
    "updated_at": "2026-10-20T00:00:00Z",
    "pushed_at": "2026-07-01T00:00:00Z",
    "fork": False,
    "archived": False,
}

# Every field each GitHub tool returns for one repository, and the words its
# description uses for that field. A field added to a tool, or words dropped
# from its description, fails test_github_tool_returns_the_fields_its_description_names.
FIELD_WORDS: dict[str, dict[str, str]] = {
    "search_repos": {
        "name": "name",
        "description": "description",
        "language": "primary language",
        "url": "url",
        "stars": "stars",
    },
    "get_repo_stats": {
        "name": "name",
        "description": "description",
        "language": "primary language",
        "stars": "stars",
        "forks": "forks",
        "topics": "topics",
        "url": "url",
        "last_updated": "last updated",
        "last_pushed": "last push",
    },
    "get_recent_activity": {
        "name": "name",
        "language": "primary language",
        "created": "created",
        "last_pushed": "last push",
        "url": "url",
    },
}

# Commit counts, pull requests and the full language breakdown are not in the
# repo list the tools fetch, and getting them takes further GitHub requests.
NOT_FETCHED = ("commit", "pull request", "languages")


class FakeClock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now


def _schema(tool: str) -> dict[str, Any]:
    return next(d["function"] for d in TOOL_DEFINITIONS if d["function"]["name"] == tool)


def _service_returning(*fetches: list[dict[str, Any]]) -> AsyncMock:
    service = AsyncMock()
    service.fetch_repos.side_effect = list(fetches)
    return service


async def _every_repo_name(tools: dict[str, Any]) -> list[str]:
    # An empty query matches every repo the tools hold.
    returned = json.loads(await tools["search_repos"](query=""))
    return [repo["name"] for repo in returned["repos"]]


@pytest.fixture
def mock_github_service() -> AsyncMock:
    service = AsyncMock()
    service.username = "DataScienceVishal"
    service.fetch_repos.return_value = [TWIN, CHESS]
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
    assert parsed["forks"] == 1
    assert parsed["language"] == "Python"


@pytest.mark.asyncio
async def test_get_repo_stats_not_found(mock_github_service: AsyncMock) -> None:
    tools = create_github_tools(mock_github_service)
    result = await tools["get_repo_stats"](repo_name="nonexistent")
    assert "not found" in result.lower()


@pytest.mark.asyncio
async def test_get_repo_stats_gives_the_push_time_apart_from_the_update_time(
    mock_github_service: AsyncMock,
) -> None:
    tools = create_github_tools(mock_github_service)
    stats = json.loads(await tools["get_repo_stats"](repo_name="chess-analytics"))
    assert stats["last_updated"] == "2026-10-20T00:00:00Z"
    assert stats["last_pushed"] == "2026-07-01T00:00:00Z"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "arguments", "list_key", "total_key", "words"),
    [
        ("search_repos", {"query": "repo"}, "repos", "total_matching", "number of matches"),
        ("get_recent_activity", {"days": 30}, "recent_repos", "total_in_period", "how many"),
    ],
)
async def test_capped_list_tool_counts_every_repo_and_says_so(
    tool: str,
    arguments: dict[str, Any],
    list_key: str,
    total_key: str,
    words: str,
) -> None:
    # Twelve repos, all named repo-N and all pushed to on the day NOW falls on.
    repos = [
        {**TWIN, "name": f"repo-{n}", "html_url": f"https://github.com/DataScienceVishal/repo-{n}"}
        for n in range(12)
    ]
    tools = create_github_tools(_service_returning(repos), now=lambda: NOW)
    returned = json.loads(await tools[tool](**arguments))

    assert len(returned[list_key]) == 10
    assert returned[total_key] == 12
    assert words in _schema(tool)["description"].lower()


@pytest.mark.asyncio
async def test_get_recent_activity_lists_repos_pushed_in_the_window_newest_first() -> None:
    tools = create_github_tools(_service_returning([CHESS, TWIN]), now=lambda: NOW)
    month = json.loads(await tools["get_recent_activity"](days=30))
    year = json.loads(await tools["get_recent_activity"](days=365))

    assert [repo["name"] for repo in month["recent_repos"]] == ["ai-professional-twin"]
    assert [repo["name"] for repo in year["recent_repos"]] == [
        "ai-professional-twin",
        "chess-analytics",
    ]


@pytest.mark.asyncio
async def test_get_recent_activity_defaults_to_the_window_its_schema_states(
    mock_github_service: AsyncMock,
) -> None:
    days = _schema("get_recent_activity")["parameters"]["properties"]["days"]
    stated = re.search(r"Defaults to (\d+)", days["description"])
    assert stated is not None

    tools = create_github_tools(mock_github_service)
    returned = json.loads(await tools["get_recent_activity"]())
    assert returned["period_days"] == int(stated.group(1))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "arguments", "list_key"),
    [
        ("search_repos", {"query": "twin"}, "repos"),
        ("get_repo_stats", {"repo_name": "ai-professional-twin"}, None),
        ("get_recent_activity", {"days": 30}, "recent_repos"),
    ],
)
async def test_github_tool_returns_the_fields_its_description_names(
    mock_github_service: AsyncMock,
    tool: str,
    arguments: dict[str, Any],
    list_key: str | None,
) -> None:
    tools = create_github_tools(mock_github_service, now=lambda: NOW)
    returned = json.loads(await tools[tool](**arguments))
    repo = returned[list_key][0] if list_key else returned

    assert sorted(repo) == sorted(FIELD_WORDS[tool])
    description = _schema(tool)["description"].lower()
    assert [words for words in FIELD_WORDS[tool].values() if words not in description] == []


@pytest.mark.parametrize("tool", list(FIELD_WORDS))
def test_github_tool_schema_names_no_data_the_tools_never_fetch(tool: str) -> None:
    schema = _schema(tool)
    params = schema["parameters"]["properties"].values()
    text = " ".join([schema["description"], *(p["description"] for p in params)]).lower()
    assert [words for words in NOT_FETCHED if words in text] == []


@pytest.mark.asyncio
async def test_repo_list_is_reused_within_the_ttl() -> None:
    clock = FakeClock()
    tools = create_github_tools(_service_returning([TWIN], [TWIN, CHESS]), now=clock)
    assert await _every_repo_name(tools) == ["ai-professional-twin"]

    clock.now += REPO_CACHE_TTL - timedelta(seconds=1)
    assert await _every_repo_name(tools) == ["ai-professional-twin"]


@pytest.mark.asyncio
async def test_repo_list_is_fetched_again_after_the_ttl() -> None:
    clock = FakeClock()
    tools = create_github_tools(_service_returning([TWIN], [TWIN, CHESS]), now=clock)
    assert await _every_repo_name(tools) == ["ai-professional-twin"]

    clock.now += REPO_CACHE_TTL + timedelta(seconds=1)
    assert await _every_repo_name(tools) == ["ai-professional-twin", "chess-analytics"]


@pytest.mark.asyncio
async def test_a_failed_refresh_keeps_the_previous_list() -> None:
    clock = FakeClock()
    # fetch_repos returns [] when GitHub answers with an error or cannot be reached.
    tools = create_github_tools(_service_returning([TWIN], []), now=clock)
    assert await _every_repo_name(tools) == ["ai-professional-twin"]

    clock.now += REPO_CACHE_TTL + timedelta(seconds=1)
    assert await _every_repo_name(tools) == ["ai-professional-twin"]


@pytest.mark.asyncio
async def test_a_failed_refresh_waits_a_full_ttl_before_the_next_request() -> None:
    clock = FakeClock()
    service = _service_returning([TWIN], [], [TWIN, CHESS])
    tools = create_github_tools(service, now=clock)
    await _every_repo_name(tools)
    clock.now += REPO_CACHE_TTL + timedelta(seconds=1)
    await _every_repo_name(tools)

    clock.now += timedelta(minutes=1)
    assert await _every_repo_name(tools) == ["ai-professional-twin"]
    assert service.fetch_repos.await_count == 2

    clock.now += REPO_CACHE_TTL
    assert await _every_repo_name(tools) == ["ai-professional-twin", "chess-analytics"]


@pytest.mark.asyncio
async def test_a_failed_first_fetch_is_retried_on_the_next_call() -> None:
    tools = create_github_tools(_service_returning([], [TWIN]), now=FakeClock())
    assert await _every_repo_name(tools) == []
    assert await _every_repo_name(tools) == ["ai-professional-twin"]
