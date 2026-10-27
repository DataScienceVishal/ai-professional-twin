from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.routers import knowledge


def test_get_projects_returns_list(client: TestClient) -> None:
    response = client.get("/projects")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_skills_returns_list(client: TestClient) -> None:
    response = client.get("/skills")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_project_by_slug_not_found(client: TestClient) -> None:
    response = client.get("/projects/nonexistent-slug")
    assert response.status_code == 404


def test_get_timeline_serves_education_and_work(client: TestClient) -> None:
    response = client.get("/timeline")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"education", "work"}
    assert body["education"]
    assert body["work"]
    for entry in body["education"]:
        assert set(entry) == {"institution", "degree", "dates", "status"}
        assert entry["dates"]
    for job in body["work"]:
        assert set(job) == {"company", "role", "dates"}
        assert job["dates"]


def test_timeline_keeps_ljmu_dates_as_vishal_corrected_them(client: TestClient) -> None:
    body = client.get("/timeline").json()

    ljmu = next(e for e in body["education"] if "(LJMU)" in e["institution"])
    assert ljmu["dates"] == "August 2023 - August 2024"


def test_timeline_serves_a_year_only_date_as_text(client: TestClient) -> None:
    body = client.get("/timeline").json()

    year_only = [e["dates"] for e in body["education"] if e["dates"].isdigit()]
    assert year_only, "the school certificates are dated by year alone"


def test_timeline_is_empty_when_the_files_are_missing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(knowledge, "KNOWLEDGE_DIR", tmp_path)

    response = client.get("/timeline")

    assert response.status_code == 200
    assert response.json() == {"education": [], "work": []}
