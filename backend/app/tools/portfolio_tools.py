import json
from collections import Counter
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

import yaml


def create_portfolio_tools(
    knowledge_dir: Path,
) -> dict[str, Callable[..., Coroutine[Any, Any, str]]]:

    def _load_yaml(filename: str) -> Any:
        path = knowledge_dir / filename
        if not path.exists():
            return None
        with open(path) as f:
            return yaml.safe_load(f)

    async def calculate_experience() -> str:
        data = _load_yaml("linkedin.yaml")
        if not data or "experience" not in data:
            return json.dumps({"error": "No experience data found"})

        positions = []
        total_months = 0
        for exp in data["experience"]:
            dates = exp.get("dates", "")
            parts = dates.split(" - ")
            if len(parts) == 2:
                from dateutil.parser import parse as parse_date

                try:
                    start = parse_date(parts[0].strip())
                    end_str = parts[1].strip()
                    if end_str.lower() == "present":
                        from datetime import datetime, timezone

                        end = datetime.now(timezone.utc)
                    else:
                        end = parse_date(end_str)
                    months = (end.year - start.year) * 12 + (end.month - start.month)
                    total_months += max(months, 0)
                except (ValueError, TypeError):
                    pass
            positions.append(
                {
                    "role": exp.get("role", ""),
                    "company": exp.get("company", ""),
                    "dates": dates,
                }
            )

        return json.dumps(
            {
                "total_years": round(total_months / 12, 1),
                "total_months": total_months,
                "positions": positions,
            }
        )

    async def count_projects_by_category() -> str:
        projects = _load_yaml("projects.yaml")
        if not projects:
            return json.dumps({"error": "No projects data found"})

        categories = Counter(p.get("category", "Uncategorized") for p in projects)
        return json.dumps(
            {
                "total": len(projects),
                "by_category": dict(categories),
            }
        )

    async def get_skill_summary(category: str = "") -> str:
        skills = _load_yaml("skills.yaml")
        if not skills:
            return json.dumps({"error": "No skills data found"})

        if category:
            skills = [s for s in skills if s["category"].lower() == category.lower()]

        return json.dumps(
            {
                "categories": [
                    {
                        "category": s["category"],
                        "proficiency": s["proficiency"],
                        "skills": s["skills"],
                    }
                    for s in skills
                ]
            }
        )

    return {
        "calculate_experience": calculate_experience,
        "count_projects_by_category": count_projects_by_category,
        "get_skill_summary": get_skill_summary,
    }
