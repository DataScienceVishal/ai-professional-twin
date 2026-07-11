from app.models.knowledge import Project, SkillCategory


def test_project_from_yaml_dict() -> None:
    data = {
        "name": "AI Twin",
        "slug": "ai-twin",
        "description": "An AI assistant",
        "tech_stack": ["Python", "FastAPI"],
        "github_url": "https://github.com/user/repo",
        "category": "AI/LLM",
        "highlights": ["Feature 1"],
    }
    project = Project(**data)
    assert project.name == "AI Twin"
    assert project.tech_stack == ["Python", "FastAPI"]


def test_skill_category_from_yaml_dict() -> None:
    data = {
        "category": "Machine Learning",
        "skills": ["PyTorch", "TensorFlow"],
        "proficiency": "advanced",
    }
    cat = SkillCategory(**data)
    assert cat.category == "Machine Learning"
    assert len(cat.skills) == 2
