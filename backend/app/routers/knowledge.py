from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.models.knowledge import Project, SkillCategory

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
