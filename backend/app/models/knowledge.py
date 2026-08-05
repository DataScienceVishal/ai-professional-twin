from pydantic import BaseModel

# Only the shapes the API actually serves live here. The knowledge YAML files
# are consumed by the chunkers as plain dicts, so modelling every file type
# bought nothing and drifted out of sync with the YAML instead.


class Project(BaseModel):
    name: str
    slug: str
    description: str
    tech_stack: list[str]
    github_url: str
    category: str
    highlights: list[str] = []


class SkillCategory(BaseModel):
    category: str
    skills: list[str]
    proficiency: str
