import tempfile

import pytest

from app.rag.store import ChromaStore, Document


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
