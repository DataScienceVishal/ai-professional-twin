import json
from collections.abc import Callable, Coroutine
from typing import Any

from app.services.github_api import GitHubAPIService


def create_github_tools(
    github_service: GitHubAPIService,
) -> dict[str, Callable[..., Coroutine[Any, Any, str]]]:
    cached_repos: list[dict] = []

    async def _get_repos() -> list[dict]:
        nonlocal cached_repos
        if not cached_repos:
            cached_repos = await github_service.fetch_repos(per_page=30)
        return cached_repos

    async def search_repos(query: str, language: str = "") -> str:
        repos = await _get_repos()
        matches = []
        query_lower = query.lower()
        for repo in repos:
            name_match = query_lower in repo["name"].lower() if query_lower else True
            desc_match = (
                query_lower in (repo.get("description") or "").lower()
                if query_lower
                else False
            )
            topic_match = (
                any(query_lower in t for t in repo.get("topics", []))
                if query_lower
                else False
            )
            lang_match = (
                (repo.get("language") or "").lower() == language.lower()
                if language
                else True
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
        return json.dumps({"repos": matches[:10]})

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
                        "topics": repo.get("topics", []),
                        "url": repo["html_url"],
                        "last_updated": repo.get("updated_at", ""),
                    }
                )
        return json.dumps({"error": f"Repository '{repo_name}' not found"})

    async def get_recent_activity(days: int = 7) -> str:
        repos = await _get_repos()
        recent = []
        for repo in repos:
            updated = repo.get("updated_at", "")
            recent.append(
                {
                    "name": repo["name"],
                    "language": repo.get("language", ""),
                    "last_updated": updated,
                    "url": repo["html_url"],
                }
            )
        recent.sort(key=lambda r: r["last_updated"], reverse=True)
        return json.dumps({"recent_repos": recent[:10], "period_days": days})

    return {
        "search_repos": search_repos,
        "get_repo_stats": get_repo_stats,
        "get_recent_activity": get_recent_activity,
    }
