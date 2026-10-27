"""OpenAI-format function-calling tool schema definitions.

Each entry follows the OpenAI chat completions tool-calling format:
{
    "type": "function",
    "function": {
        "name": str,
        "description": str,
        "parameters": {
            "type": "object",
            "properties": {...},
            "required": [...],
        },
    },
}
"""

from typing import Any

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_repos",
            "description": (
                "Search the professional's GitHub repositories by name, description "
                "and topics, optionally limited to one primary language. Returns the "
                "number of matches and up to 10 of them, each with name, description, "
                "primary language, URL and stars."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "One word or phrase, found as written (ignoring case) in a "
                            "repository's name, description or a topic, e.g. 'rag' or "
                            "'fastapi'. An empty string matches every repository."
                        ),
                    },
                    "language": {
                        "type": "string",
                        "description": (
                            "Optional primary language to keep, matched exactly but "
                            "ignoring case, e.g. 'Python' or 'TypeScript'."
                        ),
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_repo_stats",
            "description": (
                "Look up one of the professional's GitHub repositories by name. Returns "
                "its name, description, primary language, stars, forks, topics, URL "
                "and last updated time."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "repo_name": {
                        "type": "string",
                        "description": "The exact name of the repository to look up.",
                    },
                },
                "required": ["repo_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_activity",
            "description": (
                "List the professional's GitHub repositories pushed to in the last "
                "`days` days, newest push first. Returns up to 10, each with name, "
                "primary language, created date, last push time and URL."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back. Defaults to 30 if omitted.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_experience",
            "description": (
                "Calculate the professional's total years of experience based on "
                "their work history and career timeline."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "count_projects_by_category",
            "description": (
                "Count and group the professional's projects by category, such as "
                "web, mobile, data science, or machine learning."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_skill_summary",
            "description": (
                "Get a summary of the professional's skills, optionally filtered "
                "by a specific category such as 'languages', 'frameworks', or "
                "'tools'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": (
                            "Optional skill category to filter by, e.g. 'languages', "
                            "'frameworks', or 'tools'."
                        ),
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_resume_download_link",
            "description": (
                "Get a direct download link for the professional's latest resume "
                "or CV in PDF format."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_comparison_table",
            "description": (
                "Generate a markdown comparison table for a list of items across a "
                "given set of criteria, e.g. comparing projects, skills, or roles."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "The list of items to compare, e.g. project names.",
                    },
                    "criteria": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "The list of criteria to compare the items on.",
                    },
                },
                "required": ["items", "criteria"],
            },
        },
    },
]
