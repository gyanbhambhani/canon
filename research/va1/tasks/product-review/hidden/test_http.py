import pytest
from fastapi.testclient import TestClient

OK = {"rating": 4, "title": "Works well"}


def test_posts_a_review(client: TestClient) -> None:
    r = client.post("/reviews", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"rating": 1},
        {"rating": 5},
        {"title": "abc"},
        {"title": "a" * 80},
        {"title": "\U0001f600" * 3},
        {"title": "\U0001f600" * 80},
        {"title": "   "},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/reviews", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"rating": 0},
        {"rating": 6},
        {"rating": -1},
        {"title": ""},
        {"title": "ab"},
        {"title": "a" * 81},
        {"title": "\U0001f600" * 2},
        {"title": "\U0001f600" * 81},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/reviews", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/reviews", json={"rating": 3}).status_code == 422
