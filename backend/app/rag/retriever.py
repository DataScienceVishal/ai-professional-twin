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
    QueryIntent.PROJECTS: ["project", "built", "build", "created", "portfolio", "github",
                           "repository", "repo", "application", "app", "twin", "rag"],
    QueryIntent.SKILLS: ["skill", "technology", "tech", "language", "framework", "tool", "know",
                         "proficient", "experience with", "familiar", "stack"],
    QueryIntent.EXPERIENCE: ["work", "job", "company", "role", "position", "accenture", "career",
                             "employment", "professional", "engineer"],
    QueryIntent.EDUCATION: ["study", "university", "degree", "msc", "course", "thesis", "academic",
                            "northeastern", "student", "research"],
}

INTENT_FILTER_MAP: dict[QueryIntent, dict[str, str] | None] = {
    QueryIntent.PROJECTS: {"source": "projects"},
    QueryIntent.SKILLS: {"source": "skills"},
    QueryIntent.EXPERIENCE: {"source": "resume"},
    QueryIntent.EDUCATION: {"source": "resume"},
    QueryIntent.GENERAL: None,
}


class QueryClassifier:
    def classify(self, query: str) -> QueryIntent:
        query_lower = query.lower()
        scores: dict[QueryIntent, int] = {intent: 0 for intent in QueryIntent}
        for intent, keywords in INTENT_KEYWORDS.items():
            for keyword in keywords:
                if keyword in query_lower:
                    scores[intent] += 1
        best = max(scores, key=lambda k: scores[k])
        if scores[best] == 0:
            return QueryIntent.GENERAL
        return best


@dataclass
class SourceInfo:
    source: str
    detail: str


def format_context(results: list[SearchResult]) -> tuple[str, list[SourceInfo]]:
    context_parts: list[str] = []
    sources: list[SourceInfo] = []
    for result in results:
        source = result.metadata.get("source", "unknown")
        detail_parts = [v for k, v in result.metadata.items() if k != "source" and v]
        detail = " > ".join(detail_parts) if detail_parts else ""
        context_parts.append(f"[Source: {source}]\n{result.text}\n")
        sources.append(SourceInfo(source=source, detail=detail))
    return "\n".join(context_parts), sources


class Retriever:
    def __init__(
        self, store: ChromaStore, embedding_service: EmbeddingService, top_k: int = 5,
    ) -> None:
        self.store = store
        self.embedding_service = embedding_service
        self.classifier = QueryClassifier()
        self.top_k = top_k

    async def retrieve(self, query: str) -> tuple[str, list[SourceInfo]]:
        intent = self.classifier.classify(query)
        query_embedding = await self.embedding_service.embed_query(query)
        metadata_filter = INTENT_FILTER_MAP.get(intent)
        results = self.store.query(
            query_embedding=query_embedding, n_results=self.top_k, where=metadata_filter,
        )
        if not results and metadata_filter:
            results = self.store.query(query_embedding=query_embedding, n_results=self.top_k)
        return format_context(results)
