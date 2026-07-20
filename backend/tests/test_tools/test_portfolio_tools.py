import json
from pathlib import Path

import pytest

from app.tools.portfolio_tools import create_portfolio_tools


@pytest.fixture
def sample_knowledge_dir(tmp_path: Path) -> Path:
    skills_yaml = tmp_path / "skills.yaml"
    skills_yaml.write_text(
        "- category: Machine Learning\n"
        "  skills: [PyTorch, TensorFlow, Scikit-Learn]\n"
        "  proficiency: advanced\n"
        "- category: LLM Engineering\n"
        "  skills: [RAG, LangChain, Prompt Engineering]\n"
        "  proficiency: advanced\n"
        "- category: Data Engineering\n"
        "  skills: [SQL, Spark, Airflow]\n"
        "  proficiency: intermediate\n"
    )
    projects_yaml = tmp_path / "projects.yaml"
    projects_yaml.write_text(
        "- name: AI Twin\n"
        "  slug: ai-twin\n"
        "  category: AI/LLM\n"
        "  description: RAG chatbot\n"
        "  tech_stack: [Python]\n"
        "  highlights: []\n"
        "- name: Chess Analytics\n"
        "  slug: chess\n"
        "  category: Data Science\n"
        "  description: Chess analysis\n"
        "  tech_stack: [Python]\n"
        "  highlights: []\n"
        "- name: Churn Model\n"
        "  slug: churn\n"
        "  category: Machine Learning\n"
        "  description: Churn prediction\n"
        "  tech_stack: [Python]\n"
        "  highlights: []\n"
    )
    linkedin_yaml = tmp_path / "linkedin.yaml"
    linkedin_yaml.write_text(
        "headline: AI Engineer\n"
        "location: London\n"
        "experience:\n"
        "  - role: Data Associate\n"
        "    company: Teleperformance\n"
        "    dates: Jan 2023 - Aug 2024\n"
        "  - role: Application Development Analyst\n"
        "    company: Accenture\n"
        "    dates: Feb 2021 - Dec 2022\n"
    )
    return tmp_path


@pytest.mark.asyncio
async def test_calculate_experience(sample_knowledge_dir: Path) -> None:
    tools = create_portfolio_tools(sample_knowledge_dir)
    result = await tools["calculate_experience"]()
    parsed = json.loads(result)
    assert "total_years" in parsed
    assert parsed["total_years"] > 0
    assert len(parsed["positions"]) == 2


@pytest.mark.asyncio
async def test_count_projects_by_category(sample_knowledge_dir: Path) -> None:
    tools = create_portfolio_tools(sample_knowledge_dir)
    result = await tools["count_projects_by_category"]()
    parsed = json.loads(result)
    assert parsed["total"] == 3
    assert parsed["by_category"]["AI/LLM"] == 1
    assert parsed["by_category"]["Machine Learning"] == 1


@pytest.mark.asyncio
async def test_get_skill_summary_all(sample_knowledge_dir: Path) -> None:
    tools = create_portfolio_tools(sample_knowledge_dir)
    result = await tools["get_skill_summary"]()
    parsed = json.loads(result)
    assert len(parsed["categories"]) == 3


@pytest.mark.asyncio
async def test_get_skill_summary_filtered(sample_knowledge_dir: Path) -> None:
    tools = create_portfolio_tools(sample_knowledge_dir)
    result = await tools["get_skill_summary"](category="Machine Learning")
    parsed = json.loads(result)
    assert len(parsed["categories"]) == 1
    assert parsed["categories"][0]["category"] == "Machine Learning"
