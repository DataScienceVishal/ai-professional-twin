from dataclasses import dataclass, field
from typing import Any

import chromadb

# Metadata key holding the sha256 of a document's content. Written on ingest and
# read back on boot so unchanged documents are never re-embedded.
CONTENT_HASH_KEY = "content_hash"


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


@dataclass
class ManifestEntry:
    content_hash: str
    source: str


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

    def manifest(self) -> dict[str, ManifestEntry]:
        """What is already ingested, keyed by document id.

        The persisted collection *is* the manifest: keeping the hashes in
        document metadata means there is no second file that can drift out of
        sync with the vectors it describes.
        """
        result = self.collection.get(include=["metadatas"])
        entries: dict[str, ManifestEntry] = {}
        metadatas = result.get("metadatas") or []
        for i, doc_id in enumerate(result.get("ids") or []):
            metadata = dict(metadatas[i]) if i < len(metadatas) and metadatas[i] else {}
            entries[doc_id] = ManifestEntry(
                content_hash=str(metadata.get(CONTENT_HASH_KEY, "")),
                source=str(metadata.get("source", "")),
            )
        return entries

    def delete(self, ids: list[str]) -> None:
        if not ids:
            return
        self.collection.delete(ids=ids)

    def count(self) -> int:
        return self.collection.count()

    def reset(self) -> None:
        self.client.delete_collection(self.collection.name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection.name, metadata={"hnsw:space": "cosine"}
        )
