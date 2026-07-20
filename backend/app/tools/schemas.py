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
                "Search across the professional's GitHub repositories by keyword, "
                "topic, or technology. Optionally filter results by programming "
                "language."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search keywords, e.g. project name, topic, or technology.",
                    },
                    "language": {
                        "type": "string",
                        "description": (
                            "Optional programming language to filter results by, "
                            "e.g. 'Python' or 'TypeScript'."
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
                "Get detailed statistics for a specific repository, such as stars, "
                "forks, commit count, and languages used."
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
                "Get a summary of the professional's recent development activity, "
                "such as commits, pull requests, and new repositories, within a "
                "given number of days."
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
