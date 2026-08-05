import re
from dataclasses import dataclass
from enum import Enum

from app.rag.embeddings import EmbeddingService
from app.rag.store import ChromaStore, SearchResult


class QueryIntent(Enum):
    PROJECTS = "projects"
    SKILLS = "skills"
    EXPERIENCE = "experience"
    EDUCATION = "education"
    GENERAL = "general"


INTENT_KEYWORDS: dict[QueryIntent, list[str]] = {
    QueryIntent.PROJECTS: [
        "project",
        "built",
        "build",
        "created",
        "portfolio",
        "github",
        "repository",
        "repo",
        "application",
        "app",
        "twin",
        "rag",
    ],
    QueryIntent.SKILLS: [
        "skill",
        "technology",
        "tech",
        "language",
        "framework",
        "tool",
        "know",
        "proficient",
        "experience with",
        "familiar",
        "stack",
    ],
    QueryIntent.EXPERIENCE: [
        "work",
        "job",
        "company",
        "role",
        "position",
        "teleperformance",
        "avant garde",
        "career",
        "employment",
        "professional",
        "engineer",
        "salary",
        "notice period",
        "availability",
        "visa",
        "sponsorship",
    ],
    QueryIntent.EDUCATION: [
        "study",
        "studied",
        "university",
        "degree",
        "msc",
        "course",
        "thesis",
        "dissertation",
        "academic",
        "northeastern",
        "ljmu",
        "liverpool",
        "iiit",
        "bangalore",
        "student",
        "research",
        "grade",
        "module",
    ],
}

# Sources that are *preferred* for each intent. These boost ranking rather than
# filtering, so a query never loses access to a source that happens to hold the
# answer. Hard metadata filtering previously excluded academics.yaml from every
# education query, which is exactly the content those queries needed.
INTENT_SOURCE_BOOSTS: dict[QueryIntent, frozenset[str]] = {
    QueryIntent.PROJECTS: frozenset({"projects", "github"}),
    QueryIntent.SKILLS: frozenset({"skills", "career_qa", "projects"}),
    QueryIntent.EXPERIENCE: frozenset({"resume", "linkedin", "career_qa"}),
    QueryIntent.EDUCATION: frozenset({"academics", "resume", "linkedin", "career_qa"}),
    QueryIntent.GENERAL: frozenset(),
}

# Amount subtracted from cosine distance for a preferred source. Large enough to
# reorder near-ties, small enough that a clearly better match still wins.
SOURCE_BOOST = 0.12

# Cosine distance above which a chunk is considered irrelevant and dropped.
# Without this, every query returns top_k chunks no matter how poor the match,
# which makes the prompt look grounded even for off-topic questions.
MAX_DISTANCE = 0.75

# Multiplier applied to top_k when querying, so boosting and threshold filtering
# have a meaningful candidate pool to work from.
OVERFETCH_FACTOR = 4

# How many prior user turns to fold into the retrieval query, so follow-ups like
# "what tools did he use?" still retrieve against the original subject.
HISTORY_TURNS = 2


class QueryClassifier:
    def classify(self, query: str) -> QueryIntent:
        query_lower = query.lower()
        scores: dict[QueryIntent, int] = {intent: 0 for intent in QueryIntent}
        for intent, keywords in INTENT_KEYWORDS.items():
            for keyword in keywords:
                if " " in keyword:
                    if keyword in query_lower:
                        scores[intent] += 2
                elif re.search(rf"\b{re.escape(keyword)}\w*", query_lower):
                    scores[intent] += 1
        best = max(scores, key=lambda k: scores[k])
        if scores[best] == 0:
            return QueryIntent.GENERAL
        return best


@dataclass
class SourceInfo:
    source: str
    detail: str
    url: str


def _extract_url(metadata: dict[str, str]) -> str:
    return metadata.get("github_url") or metadata.get("url") or ""


def _extract_detail(metadata: dict[str, str]) -> str:
    skip = {"source", "github_url", "url", "page", "content_hash"}
    parts = [v for k, v in metadata.items() if k not in skip and v]
    return " - ".join(parts) if parts else ""


def build_retrieval_query(query: str, history: list[str] | None = None) -> str:
    """Prepend recent user turns so follow-up questions keep their subject.

    A bare "what tools did he use?" embeds to almost nothing useful. Folding in
    the previous user turns is cheaper and more predictable than an LLM
    condensation call, and needs no extra round trip.
    """
    if not history:
        return query
    recent = [turn.strip() for turn in history[-HISTORY_TURNS:] if turn.strip()]
    if not recent:
        return query
    return " ".join([*recent, query])


def rank_results(
    results: list[SearchResult],
    preferred_sources: frozenset[str],
    top_k: int,
    max_distance: float = MAX_DISTANCE,
) -> list[SearchResult]:
    """Drop weak matches, then boost preferred sources and take the best top_k."""
    relevant = [r for r in results if r.distance <= max_distance]
    if not relevant:
        # Everything scored poorly. Rather than return nothing (which makes the
        # assistant claim it knows nothing at all), fall back to the single best
        # match and let the prompt's grounding rules handle the rest.
        relevant = sorted(results, key=lambda r: r.distance)[:1]

    def effective_distance(result: SearchResult) -> float:
        if result.metadata.get("source", "") in preferred_sources:
            return result.distance - SOURCE_BOOST
        return result.distance

    return sorted(relevant, key=effective_distance)[:top_k]


def format_context(results: list[SearchResult]) -> tuple[str, list[SourceInfo]]:
    context_parts: list[str] = []
    sources: list[SourceInfo] = []
    seen: set[str] = set()
    for result in results:
        source = result.metadata.get("source", "unknown")
        url = _extract_url(result.metadata)
        detail = _extract_detail(result.metadata)
        key = f"{source}:{detail}:{url}"
        if key in seen:
            continue
        seen.add(key)
        context_parts.append(f"[Source: {source}]\n{result.text}\n")
        sources.append(SourceInfo(source=source, detail=detail, url=url))
    return "\n".join(context_parts), sources


class Retriever:
    def __init__(
        self,
        store: ChromaStore,
        embedding_service: EmbeddingService,
        top_k: int = 5,
    ) -> None:
        self.store = store
        self.embedding_service = embedding_service
        self.classifier = QueryClassifier()
        self.top_k = top_k

    async def retrieve(
        self,
        query: str,
        history: list[str] | None = None,
    ) -> tuple[str, list[SourceInfo]]:
        retrieval_query = build_retrieval_query(query, history)
        intent = self.classifier.classify(retrieval_query)
        query_embedding = await self.embedding_service.embed_query(retrieval_query)

        # Query unfiltered and rank afterwards. Metadata filtering here used to
        # hide whole files from the queries that needed them most.
        candidates = self.store.query(
            query_embedding=query_embedding,
            n_results=self.top_k * OVERFETCH_FACTOR,
        )
        ranked = rank_results(
            results=candidates,
            preferred_sources=INTENT_SOURCE_BOOSTS.get(intent, frozenset()),
            top_k=self.top_k,
        )
        return format_context(ranked)
