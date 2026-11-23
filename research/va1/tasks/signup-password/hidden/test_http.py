import pytest
from fastapi.testclient import TestClient

OK = {"email": "ada@example.com", "password": "correct horse"}


def test_signs_up(client: TestClient) -> None:
    r = client.post("/signup", json=OK)
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com"}


@pytest.mark.parametrize(
    "change",
    [
        {"email": "a@b.c"},
        {"email": "a@b.c.d"},
        {"password": "p" * 8},
        {"password": "\U0001f600" * 8},
        {"password": "p" * 100},
        {"password": "ada@example.com."},
        {"password": "da@example.com"},
        {"password": "ADA@EXAMPLE.COM"},
        {"password": "        "},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/signup", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"email": ""},
        {"email": "ab.c"},
        {"email": "a@b"},
        {"email": "@b.c"},
        {"email": "a b@c.d"},
        {"password": ""},
        {"password": "p" * 7},
        {"password": "\U0001f600" * 7},
        {"password": "ada@example.com"},
        {"email": "abcd1234@example.com", "password": "abcd1234@example.com"},
        {"email": "a@b.c.d.e.f", "password": "a@b.c.d.e.f"},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/signup", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/signup", json={"email": "a@b.c"}).status_code == 422
