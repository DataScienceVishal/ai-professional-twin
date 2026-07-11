from app.rag.retriever import QueryClassifier, QueryIntent, format_context
from app.rag.store import SearchResult


def test_classify_project_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("Tell me about the AI Twin project")
    assert intent == QueryIntent.PROJECTS


def test_classify_skills_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("What programming languages does Vishal know?")
    assert intent == QueryIntent.SKILLS


def test_classify_experience_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("Where did Vishal work before?")
    assert intent == QueryIntent.EXPERIENCE


def test_classify_general_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("Tell me about Vishal")
    assert intent == QueryIntent.GENERAL


def test_format_context_with_sources() -> None:
    results = [
        SearchResult(id="doc1", text="Data Engineer at Accenture",
                     metadata={"source": "resume", "section": "experience"}, distance=0.1),
        SearchResult(id="doc2", text="AI Professional Twin project",
                     metadata={"source": "projects", "name": "AI Twin"}, distance=0.2),
    ]
    context, sources = format_context(results)
    assert "[Source: resume]" in context
    assert "[Source: projects]" in context
    assert "Data Engineer at Accenture" in context
    assert len(sources) == 2
