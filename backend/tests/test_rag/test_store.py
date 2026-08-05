import tempfile

import pytest

from app.rag.store import CONTENT_HASH_KEY, ChromaStore, Document


@pytest.fixture
def store():
    with tempfile.TemporaryDirectory() as tmpdir:
        s = ChromaStore(persist_dir=tmpdir, collection_name="test")
        yield s


def test_add_and_query_documents(store: ChromaStore) -> None:
    docs = [
        Document(
            id="doc1",
            text="Vishal worked as a Data Engineer at Accenture",
            metadata={"source": "resume", "section": "experience"},
            embedding=[0.1] * 10,
        ),
        Document(
            id="doc2",
            text="Built ETL pipelines using Azure Data Factory",
            metadata={"source": "resume", "section": "experience"},
            embedding=[0.2] * 10,
        ),
    ]
    store.add_documents(docs)
    results = store.query(query_embedding=[0.1] * 10, n_results=2)
    assert len(results) > 0
    assert results[0].id == "doc1"


def test_query_with_metadata_filter(store: ChromaStore) -> None:
    docs = [
        Document(
            id="proj1",
            text="AI Professional Twin project",
            metadata={"source": "projects", "name": "AI Twin"},
            embedding=[0.3] * 10,
        ),
        Document(
            id="skill1",
            text="Python, FastAPI, PyTorch",
            metadata={"source": "skills", "category": "ML"},
            embedding=[0.3] * 10,
        ),
    ]
    store.add_documents(docs)
    results = store.query(query_embedding=[0.3] * 10, n_results=5, where={"source": "projects"})
    assert len(results) == 1
    assert results[0].metadata["source"] == "projects"


def test_document_count(store: ChromaStore) -> None:
    docs = [
        Document(id="d1", text="text 1", metadata={"source": "test"}, embedding=[0.1] * 10),
        Document(id="d2", text="text 2", metadata={"source": "test"}, embedding=[0.2] * 10),
    ]
    store.add_documents(docs)
    assert store.count() == 2


def test_manifest_is_empty_for_a_fresh_collection(store: ChromaStore) -> None:
    assert store.manifest() == {}


def test_manifest_returns_hashes_and_sources(store: ChromaStore) -> None:
    store.add_documents(
        [
            Document(
                id="d1",
                text="text 1",
                metadata={"source": "projects", CONTENT_HASH_KEY: "abc123"},
                embedding=[0.1] * 10,
            )
        ]
    )

    manifest = store.manifest()

    assert manifest["d1"].content_hash == "abc123"
    assert manifest["d1"].source == "projects"


def test_manifest_tolerates_documents_without_a_hash(store: ChromaStore) -> None:
    """Documents written before hashing existed must look "changed", not crash."""
    store.add_documents(
        [Document(id="d1", text="t", metadata={"source": "projects"}, embedding=[0.1] * 10)]
    )

    assert store.manifest()["d1"].content_hash == ""


def test_delete_removes_documents(store: ChromaStore) -> None:
    store.add_documents(
        [
            Document(id="d1", text="one", metadata={"source": "t"}, embedding=[0.1] * 10),
            Document(id="d2", text="two", metadata={"source": "t"}, embedding=[0.2] * 10),
        ]
    )

    store.delete(["d1"])

    assert store.count() == 1
    assert set(store.manifest()) == {"d2"}


def test_delete_with_no_ids_is_a_noop(store: ChromaStore) -> None:
    store.add_documents(
        [Document(id="d1", text="one", metadata={"source": "t"}, embedding=[0.1] * 10)]
    )

    store.delete([])

    assert store.count() == 1
