import json
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.github_api import GitHubAPIService

# The tools share one repo list and fetch it again once it is older than this,
# so new pushes and repos reach answers without a GitHub request per tool call.
REPO_CACHE_TTL = timedelta(minutes=30)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def create_github_tools(
    github_service: GitHubAPIService,
    now: Callable[[], datetime] = _utc_now,
) -> dict[str, Callable[..., Coroutine[Any, Any, str]]]:
    cached_repos: list[dict[str, Any]] = []
    fetched_at = datetime.min.replace(tzinfo=UTC)

    async def _get_repos() -> list[dict[str, Any]]:
        nonlocal cached_repos, fetched_at
        if cached_repos and now() - fetched_at < REPO_CACHE_TTL:
            return cached_repos
        fetched = await github_service.fetch_repos(per_page=100)
        # fetch_repos returns [] when GitHub answers with an error or cannot be
        # reached. A failed refresh keeps the old list and still restarts the
        # clock, so an outage costs one request per TTL instead of one per tool
        # call. With nothing held yet, the next call tries again.
        if fetched:
            cached_repos = fetched
        if cached_repos:
            fetched_at = now()
        return cached_repos

    async def search_repos(query: str, language: str = "") -> str:
        repos = await _get_repos()
        matches = []
        query_lower = query.lower()
        for repo in repos:
            name_match = query_lower in repo["name"].lower() if query_lower else True
            desc_match = (
                query_lower in (repo.get("description") or "").lower() if query_lower else False
            )
            topic_match = (
                any(query_lower in t for t in repo.get("topics", [])) if query_lower else False
            )
            lang_match = (
                (repo.get("language") or "").lower() == language.lower() if language else True
            )

            if (name_match or desc_match or topic_match) and lang_match:
                matches.append(
                    {
                        "name": repo["name"],
                        "description": repo.get("description", ""),
                        "language": repo.get("language", ""),
                        "url": repo["html_url"],
                        "stars": repo.get("stargazers_count", 0),
                    }
                )
        return json.dumps({"total_matching": len(matches), "repos": matches[:10]})

    async def get_repo_stats(repo_name: str) -> str:
        repos = await _get_repos()
        for repo in repos:
            if repo["name"].lower() == repo_name.lower():
                return json.dumps(
                    {
                        "name": repo["name"],
                        "description": repo.get("description", ""),
                        "language": repo.get("language", ""),
                        "stars": repo.get("stargazers_count", 0),
                        "forks": repo.get("forks_count", 0),
                        "topics": repo.get("topics", []),
                        "url": repo["html_url"],
                        "last_updated": repo.get("updated_at", ""),
                        "last_pushed": repo.get("pushed_at", ""),
                    }
                )
        return json.dumps({"error": f"Repository '{repo_name}' not found"})

    async def get_recent_activity(days: int = 30) -> str:
        repos = await _get_repos()
        # Filtered on the push time, since updated_at also moves on changes that
        # are not pushes. GitHub sends timestamps such as 2026-10-27T12:24:51Z,
        # so a cutoff written the same way compares correctly as a string.
        since = (now() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        recent = [
            {
                "name": repo["name"],
                "language": repo.get("language", ""),
                "created": repo.get("created_at", ""),
                "last_pushed": repo.get("pushed_at", ""),
                "url": repo["html_url"],
            }
            for repo in repos
            if repo.get("pushed_at", "") >= since
        ]
        recent.sort(key=lambda r: r["last_pushed"], reverse=True)
        return json.dumps(
            {"total_in_period": len(recent), "recent_repos": recent[:10], "period_days": days}
        )

    return {
        "search_repos": search_repos,
        "get_repo_stats": get_repo_stats,
        "get_recent_activity": get_recent_activity,
    }
