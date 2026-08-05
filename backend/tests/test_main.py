import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import __version__
from app.config import Settings, get_settings
from app.main import _build_tool_registry, create_app
from app.services.github_api import GitHubAPIService


@pytest.fixture
def local_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Keep lifespan off the network and off the real chroma directory."""
    monkeypatch.setenv("CHROMA_PERSIST_DIR", str(tmp_path / "chroma"))
    monkeypatch.setenv("INGEST_GITHUB", "false")
    monkeypatch.setenv("GITHUB_TOKEN", "")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()


def test_app_version_matches_the_package(local_env: None) -> None:
    assert create_app().version == __version__


def test_health_is_served_while_ingestion_is_still_running(local_env: None) -> None:
    """The whole point of item 1: startup must not block on ingestion."""

    async def slow_ingestion(**kwargs: Any) -> None:
        await asyncio.sleep(30)

    with patch("app.main.run_ingestion", slow_ingestion):
        app = create_app()
        with TestClient(app) as client:
            assert client.get("/health").status_code == 200
            task = app.state.ingestion_task
            assert not task.done(), "ingestion should still be in flight"

    assert task.cancelled(), "shutdown must cancel the ingestion task"


def test_ingestion_task_is_referenced_so_it_is_not_garbage_collected(
    local_env: None,
) -> None:
    async def noop_ingestion(**kwargs: Any) -> None:
        return None

    with patch("app.main.run_ingestion", noop_ingestion):
        app = create_app()
        with TestClient(app):
            assert isinstance(app.state.ingestion_task, asyncio.Task)


def test_startup_survives_an_ingestion_crash(local_env: None) -> None:
    """A crashed ingestion must be logged, not silently swallowed, and must
    not stop the app from serving."""

    async def exploding_ingestion(**kwargs: Any) -> None:
        raise RuntimeError("ingestion blew up")

    with (
        patch("app.main.run_ingestion", exploding_ingestion),
        patch("app.main._log_ingestion_outcome") as mock_callback,
    ):
        app = create_app()
        with TestClient(app) as client:
            assert client.get("/health").status_code == 200

    mock_callback.assert_called_once()
    assert isinstance(mock_callback.call_args.args[0].exception(), RuntimeError)


def test_startup_without_credentials_stays_up_and_reports_itself(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """A missing Azure key must not crash-loop the container."""
    monkeypatch.setenv("CHROMA_PERSIST_DIR", str(tmp_path / "chroma"))
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "")
    monkeypatch.setenv("GITHUB_TOKEN", "")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        assert client.get("/health").status_code == 200

        ready = client.get("/ready")
        assert ready.status_code == 503
        assert ready.json()["ingestion_error"] == "MissingCredentials"
        assert ready.json()["llm_configured"] is False

        chat = client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})
        assert chat.status_code == 503


@pytest.mark.asyncio
async def test_action_tools_use_the_api_base_url_not_the_frontend_origin() -> None:
    """Regression: this used to hand the tools cors_origins[0]."""
    settings = Settings(
        cors_origins="https://frontend.vercel.app",
        public_base_url="https://api.up.railway.app",
    )

    registry = _build_tool_registry(settings, GitHubAPIService(token="", username="someone"))
    result = await registry.execute("get_resume_download_link", {})

    url = json.loads(result)["url"]
    assert url == "https://api.up.railway.app/resume/download"
    assert "frontend.vercel.app" not in url
