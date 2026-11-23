import pytest
from fastapi.testclient import TestClient

OK = {"email": "ada@example.com", "name": "Ada"}


def test_subscribes(client: TestClient) -> None:
    r = client.post("/newsletter", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"email": "a@b.c"},
        {"email": "a@b.c.d"},
        {"name": "a"},
        {"name": " a "},
        {"name": "a" * 50},
        {"name": "\U0001f600" * 50},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/newsletter", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"email": ""},
        {"email": "ab.c"},
        {"email": "a@b"},
        {"email": "@b.c"},
        {"email": "a@@b.c"},
        {"email": "a b@c.d"},
        {"name": ""},
        {"name": "   "},
        {"name": "\t\n"},
        {"name": "a" * 51},
        {"name": "\U0001f600" * 51},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/newsletter", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/newsletter", json={"email": "a@b.c"}).status_code == 422
