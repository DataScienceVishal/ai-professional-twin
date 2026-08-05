import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.analytics import OUTCOME_ERROR, OUTCOME_OK, OUTCOME_REFUSED
from app.config import get_settings
from app.main import create_app

TOKEN = "s3cret-analytics-token"


def _row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "timestamp": "2026-08-05T10:00:00+00:00",
        "query": "Does he need a visa?",
        "mode": "recruiter",
        "outcome": OUTCOME_OK,
        "retrieved_chunks": 3,
        "has_context": True,
        "tools_used": [],
        "latency_ms": 120.0,
        "prompt_tokens": 100,
        "completion_tokens": 20,
        "total_tokens": 120,
    }
    row.update(overrides)
    return row


@pytest.fixture
def log_path(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Point the endpoint at a throwaway log, with no token configured yet."""
    path = tmp_path / "analytics" / "queries.jsonl"
    monkeypatch.setenv("ANALYTICS_LOG_PATH", str(path))
    monkeypatch.setenv("ANALYTICS_TOKEN", "")
    get_settings.cache_clear()
    return path


@pytest.fixture
def secured(monkeypatch: pytest.MonkeyPatch, log_path: Path) -> Path:
    monkeypatch.setenv("ANALYTICS_TOKEN", TOKEN)
    get_settings.cache_clear()
    return log_path


def _write(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row) + "\n" for row in rows))


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- authentication --------------------------------------------------------


def test_analytics_404s_when_no_token_is_configured(log_path: Path) -> None:
    """404 rather than 403, so a default deployment does not advertise that an
    analytics endpoint exists at all."""
    client = TestClient(create_app())

    assert client.get("/analytics").status_code == 404
    assert client.get("/analytics", headers=_auth("anything")).status_code == 404


def test_analytics_401s_without_an_authorization_header(secured: Path) -> None:
    response = TestClient(create_app()).get("/analytics")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_analytics_401s_with_the_wrong_token(secured: Path) -> None:
    response = TestClient(create_app()).get("/analytics", headers=_auth("wrong-token"))

    assert response.status_code == 401


def test_analytics_401s_when_the_scheme_is_not_bearer(secured: Path) -> None:
    response = TestClient(create_app()).get("/analytics", headers={"Authorization": TOKEN})

    assert response.status_code == 401


def test_analytics_401s_on_a_token_that_is_merely_a_prefix(secured: Path) -> None:
    response = TestClient(create_app()).get("/analytics", headers=_auth(TOKEN[:-1]))

    assert response.status_code == 401


def test_analytics_200s_with_the_right_token(secured: Path) -> None:
    _write(secured, [_row()])

    response = TestClient(create_app()).get("/analytics", headers=_auth(TOKEN))

    assert response.status_code == 200
    assert response.json()["total_queries"] == 1


def test_the_token_is_never_echoed_back(secured: Path) -> None:
    unauthorised = TestClient(create_app()).get("/analytics", headers=_auth("wrong-token"))
    authorised = TestClient(create_app()).get("/analytics", headers=_auth(TOKEN))

    assert TOKEN not in unauthorised.text
    assert TOKEN not in authorised.text


def test_analytics_is_not_advertised_in_the_openapi_schema(secured: Path) -> None:
    schema = TestClient(create_app()).get("/openapi.json").json()

    assert "/analytics" not in schema["paths"]


# --- the summary itself ----------------------------------------------------


def test_analytics_returns_an_aggregate_not_raw_rows(secured: Path) -> None:
    _write(
        secured,
        [
            _row(query="Does he need a visa?", mode="recruiter"),
            _row(query="does he need a VISA?", mode="recruiter"),
            _row(query="What is his stack?", mode="interview"),
            _row(query="Unknown topic", mode="interview", has_context=False, retrieved_chunks=0),
            _row(query="Broke", mode="default", outcome=OUTCOME_ERROR),
            _row(query="Too busy", mode="default", outcome=OUTCOME_REFUSED),
        ],
    )

    body = TestClient(create_app()).get("/analytics", headers=_auth(TOKEN)).json()

    assert body["total_queries"] == 6
    assert body["by_mode"] == {"recruiter": 2, "interview": 2, "default": 2}
    assert body["error_count"] == 1
    assert body["refusal_count"] == 1
    assert body["top_questions"][0] == {"question": "Does he need a visa?", "count": 2}
    assert body["unanswered_count"] == 1
    assert body["unanswered_questions"] == [{"question": "Unknown topic", "count": 1}]
    assert body["tokens"] == {"prompt": 600, "completion": 120, "total": 720}
    # No per-request rows, timings or anything else that would leak a transcript.
    assert "records" not in body
    assert "latency_ms" not in body


def test_analytics_on_an_empty_log_is_a_valid_empty_summary(secured: Path) -> None:
    body = TestClient(create_app()).get("/analytics", headers=_auth(TOKEN)).json()

    assert body["total_queries"] == 0
    assert body["top_questions"] == []
    assert body["tokens"] == {"prompt": 0, "completion": 0, "total": 0}
    assert body["first_query_at"] is None
