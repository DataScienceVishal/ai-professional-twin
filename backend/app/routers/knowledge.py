from pathlib import Path
from typing import Any

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
    jobs = linkedin.get("experience", []) if isinstance(linkedin, dict) else []
    return Timeline(
        education=[
            TimelineEducation(
                institution=entry["institution"],
                degree=entry["degree"],
                dates=str(entry.get("dates", "")),
                status=str(entry.get("status", "")),
            )
            for entry in academics
        ],
        work=[
            TimelineWork(
                company=job["company"],
                role=job["role"],
                dates=str(job.get("dates", "")),
            )
            for job in jobs
        ],
    )


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
