import tempfile
from pathlib import Path

import yaml

from app.rag.chunker import chunk_career_qa, chunk_projects, chunk_skills, chunk_yaml_file


def test_chunk_projects() -> None:
    projects = [{"name": "AI Twin", "slug": "ai-twin", "description": "A RAG-powered assistant",
                 "tech_stack": ["Python", "FastAPI"], "github_url": "https://github.com/user/repo",
                 "category": "AI/LLM", "highlights": ["Feature 1", "Feature 2"]}]
    docs = chunk_projects(projects)
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "projects"
    assert docs[0].metadata["name"] == "AI Twin"
    assert "Python" in docs[0].text
    assert "Feature 1" in docs[0].text


def test_chunk_skills() -> None:
    skills = [{"category": "ML", "skills": ["PyTorch", "TensorFlow"], "proficiency": "advanced"}]
    docs = chunk_skills(skills)
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "skills"
    assert docs[0].metadata["category"] == "ML"
    assert "PyTorch" in docs[0].text


def test_chunk_career_qa() -> None:
    qa_pairs = [{"question": "Why hire Vishal?", "answer": "Strong AI skills", "topic": "hiring"}]
    docs = chunk_career_qa(qa_pairs)
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "career_qa"
    assert docs[0].metadata["topic"] == "hiring"
    assert "Why hire Vishal?" in docs[0].text
    assert "Strong AI skills" in docs[0].text


def test_chunk_yaml_file_projects() -> None:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        yaml.dump([{"name": "Test", "slug": "test", "description": "Desc",
                    "tech_stack": ["Python"], "github_url": "https://gh.com",
                    "category": "AI", "highlights": []}], f)
        f.flush()
        docs = chunk_yaml_file(Path(f.name), "projects")
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "projects"
