from pathlib import Path
from typing import Any

import yaml
from pypdf import PdfReader

from app.rag.store import Document


def chunk_projects(projects: list[dict[str, Any]]) -> list[Document]:
    docs: list[Document] = []
    for p in projects:
        tech = ", ".join(p.get("tech_stack", []))
        highlights = "\n".join(f"- {h}" for h in p.get("highlights", []))
        text = (
            f"Project: {p['name']}\nCategory: {p.get('category', '')}\n"
            f"Tech Stack: {tech}\nDescription: {p['description']}\n"
        )
        if highlights:
            text += f"Key Highlights:\n{highlights}\n"
        if p.get("github_url"):
            text += f"GitHub: {p['github_url']}\n"
        docs.append(
            Document(
                id=f"project-{p['slug']}",
                text=text,
                metadata={
                    "source": "projects",
                    "name": p["name"],
                    "category": p.get("category", ""),
                    "github_url": p.get("github_url", ""),
                },
            )
        )
    return docs


def chunk_skills(skills: list[dict[str, Any]]) -> list[Document]:
    docs: list[Document] = []
    for i, cat in enumerate(skills):
        skill_list = ", ".join(cat["skills"])
        text = (
            f"Skill Category: {cat['category']}\nProficiency: {cat['proficiency']}\n"
            f"Skills: {skill_list}\n"
        )
        docs.append(
            Document(
                id=f"skills-{i}-{cat['category'].lower().replace(' ', '-')}",
                text=text,
                metadata={
                    "source": "skills",
                    "category": cat["category"],
                    "proficiency": cat["proficiency"],
                },
            )
        )
    return docs


def chunk_career_qa(qa_pairs: list[dict[str, Any]]) -> list[Document]:
    docs: list[Document] = []
    for i, qa in enumerate(qa_pairs):
        topic = qa.get("topic", "general")
        text = f"Question: {qa['question']}\nAnswer: {qa['answer']}\n"
        docs.append(
            Document(
                id=f"career-qa-{i}-{topic}",
                text=text,
                metadata={"source": "career_qa", "topic": topic},
            )
        )
    return docs


def chunk_certificates(certs: list[dict[str, Any]]) -> list[Document]:
    docs: list[Document] = []
    for i, cert in enumerate(certs):
        text = f"Certificate: {cert['name']}\nIssuer: {cert['issuer']}\nDate: {cert['date']}\n"
        cert_id = f"cert-{i}-{cert['name'].lower().replace(' ', '-')}"
        docs.append(
            Document(
                id=cert_id,
                text=text,
                metadata={"source": "certificates", "issuer": cert["issuer"]},
            )
        )
    return docs


def chunk_linkedin(data: dict[str, Any]) -> list[Document]:
    parts = [
        f"LinkedIn Profile: {data.get('headline', '')}",
        f"Location: {data.get('location', '')}",
        f"Current Role: {data.get('current_role', '')}",
        f"Summary: {data.get('summary', '')}",
    ]
    for exp in data.get("experience", []):
        desc = exp.get("description", "")
        parts.append(f"Experience: {exp['role']} at {exp['company']} ({exp['dates']}). {desc}")
    for edu in data.get("education", []):
        parts.append(f"Education: {edu['degree']} at {edu['institution']} ({edu['dates']})")
    return [
        Document(
            id="linkedin-profile",
            text="\n".join(parts),
            metadata={"source": "linkedin", "url": data.get("url", "")},
        )
    ]


def chunk_resume_pdf(pdf_path: Path) -> list[Document]:
    reader = PdfReader(str(pdf_path))
    docs: list[Document] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            docs.append(
                Document(
                    id=f"resume-page-{i}",
                    text=text.strip(),
                    metadata={"source": "resume", "page": str(i + 1)},
                )
            )
    return docs


CHUNKER_MAP = {
    "projects": chunk_projects,
    "skills": chunk_skills,
    "career_qa": chunk_career_qa,
    "certificates": chunk_certificates,
}


def chunk_yaml_file(path: Path, file_type: str) -> list[Document]:
    with open(path) as f:
        data = yaml.safe_load(f)
    if file_type == "linkedin":
        return chunk_linkedin(data)
    chunker = CHUNKER_MAP.get(file_type)
    if not chunker:
        return []
    return chunker(data)


def chunk_github_repos(
    repos: list[dict[str, Any]], readmes: dict[str, str] | None = None
) -> list[Document]:
    docs: list[Document] = []
    readmes = readmes or {}
    for repo in repos:
        name = repo["name"]
        parts = [f"GitHub Repository: {name}"]
        if repo.get("description"):
            parts.append(f"Description: {repo['description']}")
        if repo.get("language"):
            parts.append(f"Primary Language: {repo['language']}")
        if repo.get("topics"):
            parts.append(f"Topics: {', '.join(repo['topics'])}")
        parts.append(f"URL: {repo['html_url']}")
        if repo.get("stargazers_count"):
            parts.append(f"Stars: {repo['stargazers_count']}")
        readme = readmes.get(name, "")
        if readme:
            trimmed = readme[:2000]
            parts.append(f"README:\n{trimmed}")
        slug = name.lower().replace(" ", "-")
        docs.append(
            Document(
                id=f"github-repo-{slug}",
                text="\n".join(parts),
                metadata={
                    "source": "github",
                    "name": name,
                    "github_url": repo.get("html_url", ""),
                    "language": repo.get("language", ""),
                },
            )
        )
    return docs


def load_all_knowledge(knowledge_dir: Path) -> list[Document]:
    docs: list[Document] = []
    yaml_files = {
        "projects.yaml": "projects",
        "skills.yaml": "skills",
        "career_qa.yaml": "career_qa",
        "certificates.yaml": "certificates",
        "linkedin.yaml": "linkedin",
    }
    for filename, file_type in yaml_files.items():
        path = knowledge_dir / filename
        if path.exists():
            docs.extend(chunk_yaml_file(path, file_type))
    resume_path = knowledge_dir / "resume.pdf"
    if resume_path.exists():
        docs.extend(chunk_resume_pdf(resume_path))
    return docs
