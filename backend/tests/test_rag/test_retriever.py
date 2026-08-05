from typing import Any

from app.rag.retriever import (
    INTENT_SOURCE_BOOSTS,
    MAX_DISTANCE,
    SOURCE_MAX_DISTANCE,
    QueryClassifier,
    QueryIntent,
    Retriever,
    build_retrieval_query,
    format_context,
    rank_results,
    source_max_distance,
)
from app.rag.store import SearchResult


def _result(doc_id: str, source: str, distance: float, text: str = "text") -> SearchResult:
    return SearchResult(id=doc_id, text=text, metadata={"source": source}, distance=distance)


def test_classify_project_query() -> None:
    classifier = QueryClassifier()
    assert classifier.classify("Tell me about the AI Twin project") == QueryIntent.PROJECTS


def test_classify_skills_query() -> None:
    classifier = QueryClassifier()
    assert classifier.classify("What programming languages does Vishal know?") == QueryIntent.SKILLS


def test_classify_experience_query() -> None:
    classifier = QueryClassifier()
    assert classifier.classify("Where did Vishal work before?") == QueryIntent.EXPERIENCE


def test_classify_education_query() -> None:
    classifier = QueryClassifier()
    assert classifier.classify("What did he study at LJMU?") == QueryIntent.EDUCATION


def test_classify_general_query() -> None:
    classifier = QueryClassifier()
    assert classifier.classify("Tell me about Vishal") == QueryIntent.GENERAL


def test_classify_matches_word_prefixes_not_substrings() -> None:
    classifier = QueryClassifier()
    # "studied" should match the "study"/"studied" education keywords.
    assert classifier.classify("Where did he study?") == QueryIntent.EDUCATION


def test_education_intent_prefers_academics_source() -> None:
    """Regression: education queries used to hard-filter to source=resume,
    which excluded academics.yaml entirely."""
    preferred = INTENT_SOURCE_BOOSTS[QueryIntent.EDUCATION]
    assert "academics" in preferred
    assert "resume" in preferred


def test_build_retrieval_query_without_history() -> None:
    assert build_retrieval_query("What tools did he use?") == "What tools did he use?"


def test_build_retrieval_query_folds_in_history() -> None:
    result = build_retrieval_query(
        "What tools did he use?",
        history=["Tell me about his MSc thesis"],
    )
    assert "MSc thesis" in result
    assert "What tools did he use?" in result


def test_build_retrieval_query_ignores_blank_history() -> None:
    assert build_retrieval_query("hello", history=["  ", ""]) == "hello"


def test_rank_results_drops_weak_matches() -> None:
    results = [
        _result("good", "projects", 0.20),
        _result("weak", "projects", MAX_DISTANCE + 0.5),
    ]
    ranked = rank_results(results, preferred_sources=frozenset(), top_k=5)
    assert [r.id for r in ranked] == ["good"]


def test_rank_results_boosts_preferred_source() -> None:
    results = [
        _result("generic", "github", 0.30),
        _result("preferred", "academics", 0.35),
    ]
    ranked = rank_results(results, preferred_sources=frozenset({"academics"}), top_k=5)
    assert ranked[0].id == "preferred"


def test_rank_results_boost_does_not_override_clear_winner() -> None:
    results = [
        _result("much_better", "github", 0.10),
        _result("preferred", "academics", 0.60),
    ]
    ranked = rank_results(results, preferred_sources=frozenset({"academics"}), top_k=5)
    assert ranked[0].id == "much_better"


def test_rank_results_falls_back_when_everything_is_weak() -> None:
    results = [
        _result("least_bad", "projects", MAX_DISTANCE + 0.1),
        _result("worse", "projects", MAX_DISTANCE + 0.9),
    ]
    ranked = rank_results(results, preferred_sources=frozenset(), top_k=5)
    assert [r.id for r in ranked] == ["least_bad"]


def test_github_has_a_stricter_threshold_than_the_global_one() -> None:
    assert SOURCE_MAX_DISTANCE["github"] < MAX_DISTANCE


def test_source_max_distance_falls_back_to_the_global_value() -> None:
    assert source_max_distance("projects") == MAX_DISTANCE
    assert source_max_distance("github") == SOURCE_MAX_DISTANCE["github"]


def test_source_override_never_loosens_an_explicit_threshold() -> None:
    """A caller asking for a tighter bar must not have it widened by an override."""
    assert source_max_distance("github", max_distance=0.2) == 0.2


def test_github_is_dropped_at_a_distance_a_curated_source_keeps() -> None:
    """The reported bug: README prose clearing the loose bar on unrelated queries."""
    distance = (SOURCE_MAX_DISTANCE["github"] + MAX_DISTANCE) / 2
    results = [
        _result("readme_noise", "github", distance),
        _result("curated", "projects", distance),
    ]

    ranked = rank_results(results, preferred_sources=frozenset({"projects", "github"}), top_k=5)

    assert [r.id for r in ranked] == ["curated"]


def test_a_close_github_match_still_survives() -> None:
    results = [_result("on_topic", "github", SOURCE_MAX_DISTANCE["github"] - 0.05)]
    ranked = rank_results(results, preferred_sources=frozenset(), top_k=5)
    assert [r.id for r in ranked] == ["on_topic"]


def test_the_source_threshold_beats_the_intent_boost() -> None:
    """Boosting reorders near-ties; it must not resurrect a filtered-out chunk."""
    results = [
        _result("far_github", "github", MAX_DISTANCE - 0.01),
        _result("near_resume", "resume", MAX_DISTANCE - 0.02),
    ]

    ranked = rank_results(results, preferred_sources=frozenset({"github"}), top_k=5)

    assert [r.id for r in ranked] == ["near_resume"]


def test_a_lone_weak_github_chunk_still_falls_back() -> None:
    """The single-best-match fallback must survive the stricter GitHub bar."""
    results = [_result("only", "github", MAX_DISTANCE - 0.01)]
    ranked = rank_results(results, preferred_sources=frozenset(), top_k=5)
    assert [r.id for r in ranked] == ["only"]


def test_rank_results_respects_top_k() -> None:
    results = [_result(f"d{i}", "projects", 0.1 * i) for i in range(6)]
    ranked = rank_results(results, preferred_sources=frozenset(), top_k=3)
    assert len(ranked) == 3


def test_format_context_with_sources() -> None:
    results = [
        _result("doc1", "resume", 0.1, text="Data Engineer at Teleperformance"),
        _result("doc2", "projects", 0.2, text="AI Professional Twin project"),
    ]
    context, sources = format_context(results)
    assert "[Source: resume]" in context
    assert "[Source: projects]" in context
    assert "Data Engineer at Teleperformance" in context
    assert len(sources) == 2


def test_format_context_deduplicates_identical_sources() -> None:
    results = [
        _result("doc1", "skills", 0.1, text="Python"),
        _result("doc2", "skills", 0.2, text="Python"),
    ]
    _, sources = format_context(results)
    assert len(sources) == 1


class _FakeEmbeddingService:
    async def embed_query(self, query: str) -> list[float]:
        self.last_query = query
        return [0.1, 0.2, 0.3]


class _FakeStore:
    def __init__(self, results: list[SearchResult]) -> None:
        self.results = results
        self.calls: list[dict[str, Any]] = []

    def query(self, **kwargs: Any) -> list[SearchResult]:
        self.calls.append(kwargs)
        return self.results


async def test_retrieve_does_not_apply_metadata_filter() -> None:
    """The store must be queried unfiltered so no source can be hidden."""
    store = _FakeStore([_result("d1", "academics", 0.2, text="MSc at LJMU")])
    embeddings = _FakeEmbeddingService()
    retriever = Retriever(store=store, embedding_service=embeddings, top_k=5)  # type: ignore[arg-type]

    context, sources = await retriever.retrieve("What did he study at LJMU?")

    assert "where" not in store.calls[0]
    assert "MSc at LJMU" in context
    assert sources[0].source == "academics"


async def test_retrieve_uses_history_for_embedding() -> None:
    store = _FakeStore([_result("d1", "projects", 0.2)])
    embeddings = _FakeEmbeddingService()
    retriever = Retriever(store=store, embedding_service=embeddings, top_k=5)  # type: ignore[arg-type]

    await retriever.retrieve("What tools did he use?", history=["Tell me about his thesis"])

    assert "thesis" in embeddings.last_query


async def test_retrieve_overfetches_candidates() -> None:
    store = _FakeStore([_result("d1", "projects", 0.2)])
    retriever = Retriever(
        store=store,  # type: ignore[arg-type]
        embedding_service=_FakeEmbeddingService(),  # type: ignore[arg-type]
        top_k=5,
    )

    await retriever.retrieve("projects")

    assert store.calls[0]["n_results"] > 5
