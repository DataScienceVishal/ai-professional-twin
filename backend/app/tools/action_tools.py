import json
from collections.abc import Callable, Coroutine
from typing import Any


def create_action_tools(
    api_base_url: str,
) -> dict[str, Callable[..., Coroutine[Any, Any, str]]]:

    async def get_resume_download_link() -> str:
        url = f"{api_base_url}/resume/download"
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
