"""Incremental ingestion of the knowledge base into the vector store.

This runs as a background task rather than inside the lifespan startup path.
Railway's health check gives the container a short window to answer /health; a
startup that re-embedded every document (and serially fetched 100 GitHub
READMEs) blew past it, got restarted, and re-ran the whole thing — a crash loop
that billed Azure embedding calls on every pass.

Two things keep the cost down now: documents are only embedded when their
content hash changes, and GitHub is optional.
"""

import asyncio
import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import structlog

from app.config import Settings
from app.rag.chunker import chunk_github_repos, load_all_knowledge
from app.rag.embeddings import EmbeddingService
from app.rag.store import CONTENT_HASH_KEY, ChromaStore, Document
from app.services.github_api import GitHubAPIService

logger = structlog.get_logger()

# Which `source` metadata values each ingestion pass owns. Used to scope
# deletions, so a skipped GitHub pass never wipes the GitHub documents.
LOCAL_KNOWLEDGE_SOURCES = frozenset(
    {"projects", "skills", "career_qa", "certificates", "linkedin", "academics", "resume"}
)
GITHUB_SOURCES = frozenset({"github"})


@dataclass
class IngestionState:
    """Progress of the background ingestion, surfaced by /ready."""

    completed: bool = False
    # Exception class name only — this is served publicly, so no messages.
    error: str | None = None
    embedded: int = 0
    unchanged: int = 0
    deleted: int = 0
    github_skipped: bool = False
    finished_at: str | None = None


@dataclass
class SyncResult:
    embedded: int = 0
    unchanged: int = 0
    deleted: int = 0


def content_hash(doc: Document) -> str:
    """Stable sha256 over a document's text and metadata."""
    payload = json.dumps(
        {
            "text": doc.text,
            "metadata": {k: v for k, v in doc.metadata.items() if k != CONTENT_HASH_KEY},
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def sync_documents(
    store: ChromaStore,
    embedding_service: EmbeddingService,
    docs: list[Document],
    owned_sources: frozenset[str],
) -> SyncResult:
    """Embed only new or changed documents, and drop ones that no longer exist.

    `owned_sources` scopes the deletion pass so each caller can only prune the
    documents it is responsible for.
    """
    for doc in docs:
        doc.metadata[CONTENT_HASH_KEY] = content_hash(doc)

    manifest = store.manifest()
    changed = [
        doc
        for doc in docs
        if doc.id not in manifest or manifest[doc.id].content_hash != doc.metadata[CONTENT_HASH_KEY]
    ]

    if changed:
        embeddings = await embedding_service.embed_texts([doc.text for doc in changed])
        for doc, embedding in zip(changed, embeddings, strict=True):
            doc.embedding = embedding
        store.add_documents(changed)

    current_ids = {doc.id for doc in docs}
    stale = [
        doc_id
        for doc_id, entry in manifest.items()
        if entry.source in owned_sources and doc_id not in current_ids
    ]
    store.delete(stale)

    return SyncResult(
        embedded=len(changed),
        unchanged=len(docs) - len(changed),
        deleted=len(stale),
    )


async def fetch_readmes(
    github_service: GitHubAPIService,
    repos: list[dict[str, Any]],
    concurrency: int,
) -> dict[str, str]:
    """Fetch READMEs concurrently, tolerating individual failures."""
    semaphore = asyncio.Semaphore(max(concurrency, 1))

    async def fetch(name: str) -> tuple[str, str]:
        async with semaphore:
            return name, await github_service.fetch_readme(name)

    results = await asyncio.gather(
        *(fetch(str(repo["name"])) for repo in repos),
        return_exceptions=True,
    )

    readmes: dict[str, str] = {}
    for result in results:
        if isinstance(result, BaseException):
            await logger.awarning("README fetch failed", error=str(result))
            continue
        name, readme = result
        if readme:
            readmes[name] = readme
    return readmes


async def ingest_github(
    store: ChromaStore,
    embedding_service: EmbeddingService,
    github_service: GitHubAPIService,
    settings: Settings,
) -> SyncResult:
    repos = await github_service.fetch_repos(per_page=settings.github_repo_limit)
    if not repos:
        # fetch_repos already logged the reason (rate limit, auth, network).
        return SyncResult()
    readmes = await fetch_readmes(github_service, repos, settings.github_concurrency)
    docs = chunk_github_repos(repos, readmes)
    result = await sync_documents(store, embedding_service, docs, GITHUB_SOURCES)
    await logger.ainfo(
        "Ingested GitHub repos",
        repos=len(repos),
        with_readme=len(readmes),
        embedded=result.embedded,
        unchanged=result.unchanged,
        deleted=result.deleted,
    )
    return result


async def run_ingestion(
    store: ChromaStore,
    embedding_service: EmbeddingService,
    github_service: GitHubAPIService,
    settings: Settings,
    knowledge_dir: Path,
    state: IngestionState,
) -> None:
    """Bring the vector store in line with the sources. Never raises."""
    try:
        docs = load_all_knowledge(knowledge_dir)
        result = await sync_documents(store, embedding_service, docs, LOCAL_KNOWLEDGE_SOURCES)
        state.embedded += result.embedded
        state.unchanged += result.unchanged
        state.deleted += result.deleted
        await logger.ainfo(
            "Ingested local knowledge",
            embedded=result.embedded,
            unchanged=result.unchanged,
            deleted=result.deleted,
        )
    except Exception as exc:
        state.error = type(exc).__name__
        # exc_info=exc rather than aexception(): the latter also hands exc_info
        # to stdlib logging from a worker thread, which appends a bogus
        # "NoneType: None" line to every traceback.
        await logger.aerror("Local knowledge ingestion failed", exc_info=exc)
        return

    if not settings.ingest_github:
        state.github_skipped = True
        await logger.ainfo("GitHub ingestion disabled by settings")
    elif not settings.github_token:
        state.github_skipped = True
        await logger.awarning("GITHUB_TOKEN not set, serving local knowledge only")
    else:
        try:
            result = await ingest_github(store, embedding_service, github_service, settings)
            state.embedded += result.embedded
            state.unchanged += result.unchanged
            state.deleted += result.deleted
        except Exception as exc:
            # GitHub is a nice-to-have. Never let it hold back the service.
            state.github_skipped = True
            await logger.aerror("GitHub ingestion failed, continuing without it", exc_info=exc)

    state.completed = True
    state.finished_at = datetime.now(UTC).isoformat()
    await logger.ainfo(
        "Ingestion complete",
        embedded=state.embedded,
        unchanged=state.unchanged,
        deleted=state.deleted,
        github_skipped=state.github_skipped,
        documents=store.count(),
    )
