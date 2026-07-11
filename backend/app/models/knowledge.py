from pydantic import BaseModel


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


class Skill(BaseModel):
    name: str
    category: str
    proficiency: str


class Certificate(BaseModel):
    name: str
    issuer: str
    date: str
    credential_id: str = ""
    url: str = ""


class CareerQA(BaseModel):
    question: str
    answer: str
    topic: str


class LinkedInProfile(BaseModel):
    headline: str
    url: str
    location: str
    current_role: str
    summary: str
