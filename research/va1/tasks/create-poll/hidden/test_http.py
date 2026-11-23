import pytest
from fastapi.testclient import TestClient

OK = {"question": "Best colour?", "options": ["red", "green", "blue"]}


def test_creates_a_poll(client: TestClient) -> None:
    r = client.post("/polls", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"question": "q" * 5},
        {"question": "q" * 120},
        {"question": "\U0001f600" * 5},
        {"question": "\U0001f600" * 120},
        {"options": ["a", "b"]},
        {"options": ["a", "b", "c", "d", "e", "f"]},
        {"options": ["", ""]},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/polls", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"question": ""},
        {"question": "q" * 4},
        {"question": "q" * 121},
        {"question": "\U0001f600" * 4},
        {"question": "\U0001f600" * 121},
        {"options": []},
        {"options": ["a"]},
        {"options": ["a", "b", "c", "d", "e", "f", "g"]},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/polls", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/polls", json={"question": "Best colour?"}).status_code == 422
