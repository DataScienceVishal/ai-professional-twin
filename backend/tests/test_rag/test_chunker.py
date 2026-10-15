from collections import Counter
from pathlib import Path

import yaml

from app.main import KNOWLEDGE_DIR
from app.rag.chunker import (
    chunk_career_qa,
    chunk_projects,
    chunk_skills,
    chunk_yaml_file,
    load_all_knowledge,
)


def test_chunk_projects() -> None:
    projects = [
        {
            "name": "AI Twin",
            "slug": "ai-twin",
            "description": "A RAG-powered assistant",
            "tech_stack": ["Python", "FastAPI"],
            "github_url": "https://github.com/user/repo",
            "category": "AI/LLM",
            "highlights": ["Feature 1", "Feature 2"],
        }
    ]
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


def test_chunk_yaml_file_projects(tmp_path: Path) -> None:
    path = tmp_path / "projects.yaml"
    with path.open("w") as f:
        yaml.dump(
            [
                {
                    "name": "Test",
                    "slug": "test",
                    "description": "Desc",
                    "tech_stack": ["Python"],
                    "github_url": "https://gh.com",
                    "category": "AI",
                    "highlights": [],
                }
            ],
            f,
        )
    docs = chunk_yaml_file(path, "projects")
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "projects"


def test_load_all_knowledge_on_the_real_directory() -> None:
    """load_all_knowledge skips a missing file and run_ingestion catches a load error,
    so a missing YAML file, or any file that will not load, has to fail here."""
    docs = load_all_knowledge(KNOWLEDGE_DIR)

    # Typed out from yaml_files in load_all_knowledge, so that deleting an entry
    # there, which stops that file loading with no error, fails this test.
    expected = ("projects", "skills", "career_qa", "certificates", "linkedin", "academics")
    sources = {doc.metadata["source"] for doc in docs}
    missing = [f"{source}.yaml" for source in expected if source not in sources]
    assert not missing, f"files with no documents: {missing}"

    repeated = [doc_id for doc_id, count in Counter(doc.id for doc in docs).items() if count > 1]
    assert not repeated, f"duplicate document ids: {repeated}"

    blank = [doc.id for doc in docs if not doc.text.strip()]
    assert not blank, f"documents with no text: {blank}"
