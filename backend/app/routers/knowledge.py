from pathlib import Path
from typing import Any

import structlog
import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.models.knowledge import (
    Project,
    SkillCategory,
    Timeline,
    TimelineEducation,
    TimelineWork,
)

router = APIRouter()
logger = structlog.get_logger()

KNOWLEDGE_DIR = Path(__file__).parent.parent.parent / "knowledge"


def _load_yaml(filename: str) -> Any:
    path = KNOWLEDGE_DIR / filename
    if not path.exists():
        return []
    with open(path) as f:
        return yaml.safe_load(f) or []


@router.get("/projects")
async def list_projects() -> list[Project]:
    data = _load_yaml("projects.yaml")
    return [Project(**p) for p in data]


@router.get("/projects/{slug}")
async def get_project(slug: str) -> Project:
    data = _load_yaml("projects.yaml")
    for p in data:
        if p["slug"] == slug:
            return Project(**p)
    raise HTTPException(status_code=404, detail="Project not found")


@router.get("/skills")
async def list_skills() -> list[SkillCategory]:
    data = _load_yaml("skills.yaml")
    return [SkillCategory(**s) for s in data]


@router.get("/timeline")
async def get_timeline() -> Timeline:
    """Dated education and work entries, served as academics.yaml and linkedin.yaml write them.

    The page's route map plots these. The assistant retrieves from the same two files.
    """
    academics = _load_yaml("academics.yaml")
    linkedin = _load_yaml("linkedin.yaml")
    jobs = (linkedin.get("experience") if isinstance(linkedin, dict) else None) or []
    # One malformed entry must not take the whole map down: it is skipped and logged.
    return Timeline(
        education=[
            TimelineEducation(
                institution=str(entry["institution"]),
                degree=str(entry["degree"]),
                dates=str(entry.get("dates") or ""),
                status=str(entry.get("status") or ""),
            )
            for entry in _complete(academics, "academics.yaml", ("institution", "degree"))
        ],
        work=[
            TimelineWork(
                company=str(job["company"]),
                role=str(job["role"]),
                dates=str(job.get("dates") or ""),
            )
            for job in _complete(jobs, "linkedin.yaml", ("company", "role"))
        ],
    )


def _complete(entries: Any, filename: str, required: tuple[str, ...]) -> list[dict[str, Any]]:
    """The entries that are mappings carrying every required key; the rest are logged."""
    if not isinstance(entries, list):
        logger.warning("Timeline file is not a list", file=filename)
        return []
    kept = []
    for index, entry in enumerate(entries):
        if isinstance(entry, dict) and all(entry.get(key) for key in required):
            kept.append(entry)
        else:
            logger.warning("Skipped a malformed timeline entry", file=filename, index=index)
    return kept


@router.get("/resume/download")
async def download_resume() -> FileResponse:
    path = KNOWLEDGE_DIR / "resume.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Resume not found")
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename="Vishal_Khan_Resume.pdf",
    )
