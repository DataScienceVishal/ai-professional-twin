from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import __version__
from app.ingest import IngestionState
from app.main import create_app


class FakeStore:
    def __init__(self, count: int) -> None:
        self._count = count

    def count(self) -> int:
        return self._count


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "version" in body


def test_health_reports_the_package_version(app: FastAPI) -> None:
    """/health, the FastAPI app and pyproject must all agree."""
    assert TestClient(app).get("/health").json()["version"] == __version__
    assert app.version == __version__


def test_health_does_not_depend_on_ingestion(app: FastAPI) -> None:
    """Railway polls /health, so it must answer before ingestion finishes."""
    app.state.ingestion = IngestionState(completed=False)
    app.state.store = FakeStore(0)

    assert TestClient(app).get("/health").status_code == 200


def test_ready_returns_503_when_the_knowledge_base_is_empty(app: FastAPI) -> None:
    app.state.store = FakeStore(0)
    app.state.ingestion = IngestionState(completed=False)

    response = TestClient(app).get("/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "not_ready"
    assert body["document_count"] == 0
    assert body["ingestion_complete"] is False


def test_ready_returns_200_once_documents_are_indexed(app: FastAPI) -> None:
    app.state.store = FakeStore(42)
    app.state.ingestion = IngestionState(completed=True)

    response = TestClient(app).get("/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["document_count"] == 42
    assert body["ingestion_complete"] is True
    assert body["llm_configured"] is True


def test_ready_reports_ingestion_errors() -> None:
    uninitialised = create_app()
    uninitialised.state.store = FakeStore(0)
    uninitialised.state.ingestion = IngestionState(completed=False, error="AuthenticationError")

    body = TestClient(uninitialised).get("/ready").json()

    assert body["ingestion_error"] == "AuthenticationError"
    assert body["llm_configured"] is False


def test_ready_survives_a_missing_store() -> None:
    """A store that never got built must 503, not 500."""
    response = TestClient(create_app()).get("/ready")

    assert response.status_code == 503
    assert response.json()["document_count"] == 0
