from fastapi.testclient import TestClient


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
