from dataclasses import dataclass, field
from typing import Any

import chromadb


@dataclass
class Document:
    id: str
    text: str
    metadata: dict[str, str]
    embedding: list[float] = field(default_factory=list)


@dataclass
class SearchResult:
    id: str
    text: str
    metadata: dict[str, str]
    distance: float


class ChromaStore:
    def __init__(self, persist_dir: str, collection_name: str = "knowledge") -> None:
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(self, documents: list[Document]) -> None:
        if not documents:
            return
        self.collection.upsert(
            ids=[d.id for d in documents],
            documents=[d.text for d in documents],
            metadatas=[d.metadata for d in documents],
            embeddings=[d.embedding for d in documents] if documents[0].embedding else None,  # type: ignore[arg-type]
        )

    def query(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        where: dict[str, str] | None = None,
    ) -> list[SearchResult]:
        kwargs: dict[str, Any] = {"query_embeddings": [query_embedding], "n_results": n_results}
        if where:
            kwargs["where"] = where
        results = self.collection.query(**kwargs)
        search_results: list[SearchResult] = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                search_results.append(
                    SearchResult(
                        id=doc_id,
                        text=results["documents"][0][i] if results["documents"] else "",
                        metadata=dict(results["metadatas"][0][i]) if results["metadatas"] else {},  # type: ignore[arg-type]
                        distance=results["distances"][0][i] if results["distances"] else 0.0,
                    )
                )
        return search_results

    def count(self) -> int:
        return self.collection.count()

    def reset(self) -> None:
        self.client.delete_collection(self.collection.name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection.name, metadata={"hnsw:space": "cosine"}
        )
