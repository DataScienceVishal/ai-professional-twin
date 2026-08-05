import asyncio
import tempfile
from pathlib import Path
from typing import Any

import pytest
import yaml

from app.config import Settings
from app.ingest import (
    GITHUB_SOURCES,
    LOCAL_KNOWLEDGE_SOURCES,
    SKIP_ARCHIVED,
    SKIP_EXCLUDED,
    SKIP_FORK,
    SKIP_NO_CONTENT,
    IngestionState,
    content_hash,
    drop_contentless_repos,
    fetch_readmes,
    filter_repos,
    run_ingestion,
    sync_documents,
)
from app.rag.store import CONTENT_HASH_KEY, ChromaStore, Document


class FakeEmbeddings:
    """Records what was sent for embedding, so tests can assert on cost."""

    def __init__(self) -> None:
        self.batches: list[list[str]] = []

    async def embed_texts(self, texts: list[str], batch_size: int = 64) -> list[list[float]]:
        self.batches.append(list(texts))
        return [[0.1] * 8 for _ in texts]

    @property
    def embedded_count(self) -> int:
        return sum(len(batch) for batch in self.batches)


class FakeGitHub:
    def __init__(
        self,
        repos: list[dict[str, Any]] | None = None,
        readme_error: bool = False,
        without_readme: set[str] | None = None,
    ) -> None:
        self.repos = repos or []
        self.readme_error = readme_error
        self.without_readme = without_readme or set()
        self.readme_calls: list[str] = []
        self.concurrent = 0
        self.max_concurrent = 0

    async def fetch_repos(self, per_page: int = 10) -> list[dict[str, Any]]:
        return self.repos

    async def fetch_readme(self, repo_name: str) -> str:
        self.readme_calls.append(repo_name)
        self.concurrent += 1
        self.max_concurrent = max(self.max_concurrent, self.concurrent)
        try:
            await asyncio.sleep(0)
            if self.readme_error:
                raise RuntimeError("boom")
            if repo_name in self.without_readme:
                return ""
            return f"# {repo_name}"
        finally:
            self.concurrent -= 1


def _repo(name: str, **overrides: Any) -> dict[str, Any]:
    """A repo shaped like GitHubAPIService.fetch_repos output."""
    repo: dict[str, Any] = {
        "name": name,
        "description": f"About {name}",
        "html_url": f"https://github.com/DataScienceVishal/{name}",
        "language": "Python",
        "stargazers_count": 0,
        "topics": [],
        "updated_at": "2026-07-01T00:00:00Z",
        "fork": False,
        "archived": False,
    }
    repo.update(overrides)
    return repo


@pytest.fixture
def store():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield ChromaStore(persist_dir=tmpdir, collection_name="test")


def _doc(doc_id: str, text: str, source: str = "projects") -> Document:
    return Document(id=doc_id, text=text, metadata={"source": source})


def test_content_hash_is_stable_and_content_sensitive() -> None:
    a = _doc("d1", "hello")
    b = _doc("d1", "hello")
    c = _doc("d1", "hello world")
    assert content_hash(a) == content_hash(b)
    assert content_hash(a) != content_hash(c)


def test_content_hash_ignores_the_hash_key_itself() -> None:
    """Re-hashing an already-tagged document must not change the result."""
    doc = _doc("d1", "hello")
    first = content_hash(doc)
    doc.metadata[CONTENT_HASH_KEY] = first
    assert content_hash(doc) == first


def test_content_hash_tracks_metadata() -> None:
    assert content_hash(_doc("d1", "hi", source="projects")) != content_hash(
        _doc("d1", "hi", source="skills")
    )


@pytest.mark.asyncio
async def test_first_sync_embeds_everything(store: ChromaStore) -> None:
    embeddings = FakeEmbeddings()
    docs = [_doc("d1", "one"), _doc("d2", "two")]

    result = await sync_documents(store, embeddings, docs, LOCAL_KNOWLEDGE_SOURCES)

    assert result.embedded == 2
    assert result.unchanged == 0
    assert store.count() == 2


@pytest.mark.asyncio
async def test_second_sync_embeds_nothing_when_unchanged(store: ChromaStore) -> None:
    """The whole point: a restart must not re-bill every document."""
    embeddings = FakeEmbeddings()
    await sync_documents(store, embeddings, [_doc("d1", "one")], LOCAL_KNOWLEDGE_SOURCES)
    assert embeddings.embedded_count == 1

    result = await sync_documents(store, embeddings, [_doc("d1", "one")], LOCAL_KNOWLEDGE_SOURCES)

    assert result.embedded == 0
    assert result.unchanged == 1
    assert embeddings.embedded_count == 1


@pytest.mark.asyncio
async def test_only_changed_documents_are_re_embedded(store: ChromaStore) -> None:
    embeddings = FakeEmbeddings()
    await sync_documents(
        store, embeddings, [_doc("d1", "one"), _doc("d2", "two")], LOCAL_KNOWLEDGE_SOURCES
    )

    result = await sync_documents(
        store,
        embeddings,
        [_doc("d1", "one"), _doc("d2", "two CHANGED")],
        LOCAL_KNOWLEDGE_SOURCES,
    )

    assert result.embedded == 1
    assert result.unchanged == 1
    assert embeddings.batches[-1] == ["two CHANGED"]


@pytest.mark.asyncio
async def test_removed_documents_are_deleted(store: ChromaStore) -> None:
    embeddings = FakeEmbeddings()
    await sync_documents(
        store, embeddings, [_doc("d1", "one"), _doc("d2", "two")], LOCAL_KNOWLEDGE_SOURCES
    )

    result = await sync_documents(store, embeddings, [_doc("d1", "one")], LOCAL_KNOWLEDGE_SOURCES)

    assert result.deleted == 1
    assert store.count() == 1
    assert set(store.manifest()) == {"d1"}


@pytest.mark.asyncio
async def test_deletion_is_scoped_to_owned_sources(store: ChromaStore) -> None:
    """A local-knowledge sync must never prune GitHub documents, and vice versa."""
    embeddings = FakeEmbeddings()
    await sync_documents(store, embeddings, [_doc("gh-1", "repo", source="github")], GITHUB_SOURCES)
    await sync_documents(store, embeddings, [_doc("d1", "one")], LOCAL_KNOWLEDGE_SOURCES)

    # Local knowledge disappears entirely; the GitHub document must survive.
    result = await sync_documents(store, embeddings, [], LOCAL_KNOWLEDGE_SOURCES)

    assert result.deleted == 1
    assert set(store.manifest()) == {"gh-1"}


@pytest.mark.asyncio
async def test_fetch_readmes_respects_the_concurrency_limit() -> None:
    github = FakeGitHub()
    repos = [{"name": f"repo-{i}"} for i in range(20)]

    readmes = await fetch_readmes(github, repos, concurrency=5)

    assert len(readmes) == 20
    assert github.max_concurrent <= 5


@pytest.mark.asyncio
async def test_fetch_readmes_survives_individual_failures() -> None:
    github = FakeGitHub(readme_error=True)
    repos = [{"name": "repo-1"}, {"name": "repo-2"}]

    readmes = await fetch_readmes(github, repos, concurrency=5)

    assert readmes == {}


def test_filter_repos_keeps_an_ordinary_repo() -> None:
    kept, skipped = filter_repos([_repo("ai-professional-twin")], Settings())

    assert [r["name"] for r in kept] == ["ai-professional-twin"]
    assert skipped == {}


def test_filter_repos_excludes_a_denylisted_repo() -> None:
    kept, skipped = filter_repos(
        [_repo("my-ai-resume"), _repo("ai-professional-twin")],
        Settings(),
    )

    assert [r["name"] for r in kept] == ["ai-professional-twin"]
    assert skipped[SKIP_EXCLUDED] == 1


def test_denylist_matches_case_insensitively() -> None:
    """GitHub repo names are case-preserving; the denylist must not be fooled."""
    kept, skipped = filter_repos(
        [_repo("My-AI-Resume")],
        Settings(github_exclude_repos="my-ai-resume"),
    )

    assert kept == []
    assert skipped[SKIP_EXCLUDED] == 1


def test_denylist_matches_the_whole_name_not_a_substring() -> None:
    kept, _ = filter_repos(
        [_repo("my-ai-resume-v2")],
        Settings(github_exclude_repos="my-ai-resume"),
    )

    assert [r["name"] for r in kept] == ["my-ai-resume-v2"]


def test_filter_repos_skips_forks() -> None:
    kept, skipped = filter_repos([_repo("someone-elses-lib", fork=True)], Settings())

    assert kept == []
    assert skipped[SKIP_FORK] == 1


def test_filter_repos_skips_archived_repos() -> None:
    kept, skipped = filter_repos([_repo("old-thing", archived=True)], Settings())

    assert kept == []
    assert skipped[SKIP_ARCHIVED] == 1


def test_fork_and_archive_gates_can_be_switched_off() -> None:
    kept, skipped = filter_repos(
        [_repo("a-fork", fork=True), _repo("an-archive", archived=True)],
        Settings(github_skip_forks=False, github_skip_archived=False),
    )

    assert [r["name"] for r in kept] == ["a-fork", "an-archive"]
    assert skipped == {}


def test_drop_contentless_repos_skips_repos_with_nothing_to_embed() -> None:
    kept, skipped = drop_contentless_repos([_repo("bare", description="")], readmes={})

    assert kept == []
    assert skipped[SKIP_NO_CONTENT] == 1


def test_drop_contentless_repos_keeps_a_description_only_repo() -> None:
    kept, skipped = drop_contentless_repos([_repo("described")], readmes={})

    assert [r["name"] for r in kept] == ["described"]
    assert skipped == {}


def test_drop_contentless_repos_keeps_a_readme_only_repo() -> None:
    kept, _ = drop_contentless_repos(
        [_repo("documented", description="")],
        readmes={"documented": "# documented\nA real project."},
    )

    assert [r["name"] for r in kept] == ["documented"]


def test_drop_contentless_repos_ignores_whitespace_only_content() -> None:
    kept, skipped = drop_contentless_repos(
        [_repo("blank", description="   ")],
        readmes={"blank": "\n \n"},
    )

    assert kept == []
    assert skipped[SKIP_NO_CONTENT] == 1


def _knowledge_dir(tmp_path: Path) -> Path:
    (tmp_path / "skills.yaml").write_text(
        yaml.safe_dump([{"category": "Python", "skills": ["FastAPI"], "proficiency": "Expert"}])
    )
    return tmp_path


@pytest.mark.asyncio
async def test_run_ingestion_skips_github_when_disabled(store: ChromaStore, tmp_path: Path) -> None:
    state = IngestionState()
    github = FakeGitHub(repos=[{"name": "repo-1", "html_url": "u"}])

    await run_ingestion(
        store=store,
        embedding_service=FakeEmbeddings(),
        github_service=github,
        settings=Settings(ingest_github=False, github_token="tok"),
        knowledge_dir=_knowledge_dir(tmp_path),
        state=state,
    )

    assert state.completed is True
    assert state.github_skipped is True
    assert all(entry.source != "github" for entry in store.manifest().values())


@pytest.mark.asyncio
async def test_run_ingestion_skips_github_without_a_token(
    store: ChromaStore, tmp_path: Path
) -> None:
    state = IngestionState()

    await run_ingestion(
        store=store,
        embedding_service=FakeEmbeddings(),
        github_service=FakeGitHub(),
        settings=Settings(ingest_github=True, github_token=""),
        knowledge_dir=_knowledge_dir(tmp_path),
        state=state,
    )

    assert state.completed is True
    assert state.github_skipped is True
    assert state.embedded == 1


@pytest.mark.asyncio
async def test_run_ingestion_survives_a_github_outage(store: ChromaStore, tmp_path: Path) -> None:
    """GitHub being down must never stop the app serving local knowledge."""

    class ExplodingGitHub(FakeGitHub):
        async def fetch_repos(self, per_page: int = 10) -> list[dict[str, Any]]:
            raise RuntimeError("GitHub is down")

    state = IngestionState()

    await run_ingestion(
        store=store,
        embedding_service=FakeEmbeddings(),
        github_service=ExplodingGitHub(),
        settings=Settings(ingest_github=True, github_token="tok"),
        knowledge_dir=_knowledge_dir(tmp_path),
        state=state,
    )

    assert state.completed is True
    assert state.github_skipped is True
    assert state.embedded == 1


@pytest.mark.asyncio
async def test_run_ingestion_records_a_failure_without_raising(
    store: ChromaStore, tmp_path: Path
) -> None:
    class BrokenEmbeddings(FakeEmbeddings):
        async def embed_texts(self, texts: list[str], batch_size: int = 64) -> list[list[float]]:
            raise RuntimeError("azure key: sk-secret-should-not-leak")

    state = IngestionState()

    await run_ingestion(
        store=store,
        embedding_service=BrokenEmbeddings(),
        github_service=FakeGitHub(),
        settings=Settings(ingest_github=False, github_token=""),
        knowledge_dir=_knowledge_dir(tmp_path),
        state=state,
    )

    assert state.completed is False
    # Only the exception class name is retained; /ready serves this publicly.
    assert state.error == "RuntimeError"


@pytest.mark.asyncio
async def test_run_ingestion_ingests_github_repos(store: ChromaStore, tmp_path: Path) -> None:
    github = FakeGitHub(repos=[{"name": "repo-1", "html_url": "https://gh/repo-1"}])
    state = IngestionState()

    await run_ingestion(
        store=store,
        embedding_service=FakeEmbeddings(),
        github_service=github,
        settings=Settings(ingest_github=True, github_token="tok"),
        knowledge_dir=_knowledge_dir(tmp_path),
        state=state,
    )

    assert state.completed is True
    assert state.github_skipped is False
    sources = {entry.source for entry in store.manifest().values()}
    assert "github" in sources


def _github_ids(store: ChromaStore) -> set[str]:
    return {doc_id for doc_id, entry in store.manifest().items() if entry.source == "github"}


@pytest.mark.asyncio
async def test_run_ingestion_filters_low_signal_repos(store: ChromaStore, tmp_path: Path) -> None:
    """Only the repo worth citing should end up in the store."""
    github = FakeGitHub(
        repos=[
            _repo("ai-professional-twin"),
            _repo("My-AI-Resume"),
            _repo("someone-elses-lib", fork=True),
            _repo("old-thing", archived=True),
            _repo("DataScienceVishal", description=""),
        ],
        without_readme={"DataScienceVishal"},
    )
    state = IngestionState()

    await run_ingestion(
        store=store,
        embedding_service=FakeEmbeddings(),
        github_service=github,
        settings=Settings(ingest_github=True, github_token="tok"),
        knowledge_dir=_knowledge_dir(tmp_path),
        state=state,
    )

    assert state.completed is True
    assert state.github_skipped is False
    assert _github_ids(store) == {"github-repo-ai-professional-twin"}
    # Repos rejected on the cheap checks cost no README round trip.
    assert "My-AI-Resume" not in github.readme_calls
    assert "someone-elses-lib" not in github.readme_calls


@pytest.mark.asyncio
async def test_run_ingestion_prunes_a_newly_denylisted_repo(
    store: ChromaStore, tmp_path: Path
) -> None:
    """A repo already in the store must disappear once it is denylisted."""
    embeddings = FakeEmbeddings()
    knowledge_dir = _knowledge_dir(tmp_path)
    repos = [_repo("ai-professional-twin"), _repo("my-ai-resume")]

    await run_ingestion(
        store=store,
        embedding_service=embeddings,
        github_service=FakeGitHub(repos=repos),
        settings=Settings(ingest_github=True, github_token="tok", github_exclude_repos=""),
        knowledge_dir=knowledge_dir,
        state=IngestionState(),
    )
    assert "github-repo-my-ai-resume" in _github_ids(store)

    await run_ingestion(
        store=store,
        embedding_service=embeddings,
        github_service=FakeGitHub(repos=repos),
        settings=Settings(ingest_github=True, github_token="tok"),
        knowledge_dir=knowledge_dir,
        state=IngestionState(),
    )

    assert _github_ids(store) == {"github-repo-ai-professional-twin"}


@pytest.mark.asyncio
async def test_run_ingestion_keeps_github_docs_when_the_api_returns_nothing(
    store: ChromaStore, tmp_path: Path
) -> None:
    """An empty fetch is an outage, not a signal to prune the whole source."""
    embeddings = FakeEmbeddings()
    knowledge_dir = _knowledge_dir(tmp_path)

    await run_ingestion(
        store=store,
        embedding_service=embeddings,
        github_service=FakeGitHub(repos=[_repo("ai-professional-twin")]),
        settings=Settings(ingest_github=True, github_token="tok"),
        knowledge_dir=knowledge_dir,
        state=IngestionState(),
    )

    await run_ingestion(
        store=store,
        embedding_service=embeddings,
        github_service=FakeGitHub(repos=[]),
        settings=Settings(ingest_github=True, github_token="tok"),
        knowledge_dir=knowledge_dir,
        state=IngestionState(),
    )

    assert _github_ids(store) == {"github-repo-ai-professional-twin"}
