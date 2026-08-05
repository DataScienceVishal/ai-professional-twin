import json
from collections.abc import Callable, Coroutine
from typing import Any


def create_action_tools(
    api_base_url: str,
) -> dict[str, Callable[..., Coroutine[Any, Any, str]]]:
    """`api_base_url` is this api's own public origin: the links built below
    (/resume/download) are served by this service, not by the frontend."""
    base_url = api_base_url.rstrip("/")

    async def get_resume_download_link() -> str:
        url = f"{base_url}/resume/download"
        return json.dumps(
            {
                "url": url,
                "label": "Download Vishal Khan's Resume (PDF)",
            }
        )

    async def generate_comparison_table(items: list[str], criteria: list[str]) -> str:
        header = "| Criteria | " + " | ".join(items) + " |"
        separator = "|" + "|".join(["---"] * (len(items) + 1)) + "|"
        rows = [f"| {c} | " + " | ".join(["..." for _ in items]) + " |" for c in criteria]
        table = "\n".join([header, separator, *rows])
        return table

    return {
        "get_resume_download_link": get_resume_download_link,
        "generate_comparison_table": generate_comparison_table,
    }
