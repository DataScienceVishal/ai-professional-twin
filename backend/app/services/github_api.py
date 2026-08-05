from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


class GitHubAPIService:
    def __init__(self, token: str, username: str) -> None:
        self.token = token
        self.username = username
        self.base_url = "https://api.github.com"

    async def fetch_repos(self, per_page: int = 10) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/users/{self.username}/repos",
                    params={"sort": "updated", "per_page": per_page},
                    headers={
                        "Authorization": f"Bearer {self.token}",
                        "Accept": "application/vnd.github+json",
                    },
                    timeout=10.0,
                )

            if response.status_code != 200:
                await logger.awarning(
                    "GitHub API error",
                    status=response.status_code,
                    body=response.text[:500],
                )
                return []

            # description, language and topics are nullable in the API response,
            # so `or` rather than a dict default: the key is present and set to
            # null for a repo with no description at all.
            return [
                {
                    "name": repo["name"],
                    "description": repo.get("description") or "",
                    "html_url": repo["html_url"],
                    "language": repo.get("language") or "",
                    "stargazers_count": repo.get("stargazers_count", 0),
                    "topics": repo.get("topics") or [],
                    "updated_at": repo.get("updated_at", ""),
                    # Ingestion quality gates. Both are always present on the
                    # list-repos payload; defaulted anyway so a trimmed fixture
                    # or a future API change cannot drop a real repo.
                    "fork": bool(repo.get("fork", False)),
                    "archived": bool(repo.get("archived", False)),
                }
                for repo in response.json()
            ]
        except httpx.HTTPError as e:
            await logger.aerror("GitHub API request failed", error=str(e))
            return []

    async def fetch_readme(self, repo_name: str) -> str:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{self.username}/{repo_name}/readme",
                    headers={
                        "Authorization": f"Bearer {self.token}",
                        "Accept": "application/vnd.github.raw+json",
                    },
                    timeout=10.0,
                )
            if response.status_code == 200:
                return response.text
            return ""
        except httpx.HTTPError:
            return ""
