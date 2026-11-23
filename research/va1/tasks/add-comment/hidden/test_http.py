import pytest
from fastapi.testclient import TestClient

OK = {"body": "Nice post"}


def test_adds_a_comment(client: TestClient) -> None:
    r = client.post("/comments", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"body": "a"},
        {"body": " a "},
        {"body": "\n\tx\r"},
        {"body": "a" * 500},
        {"body": "\U0001f600" * 500},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/comments", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"body": ""},
        {"body": " "},
        {"body": "\t \n\r"},
        {"body": "a" * 501},
        {"body": "\U0001f600" * 501},
        {"body": "a" * 600},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/comments", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/comments", json={}).status_code == 422
