import pytest
from fastapi.testclient import TestClient

OK = {'email': 'ada@example.com', 'accepted': True}
PATH = "/terms"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'email': 'ada@example.com', 'accepted': True}


@pytest.mark.parametrize(
    "change",
    [
        {'email': 'a@b.c'},
        {'email': 'first.last+tag@sub.example.org'},
        {'email': 'a@b.c.d'},
        {'email': 'a@..c'},
        {'email': '😀@b.c'},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'accepted': False},
        {'email': ''},
        {'email': 'plain'},
        {'email': 'a@b'},
        {'email': 'a@b.'},
        {'email': '@b.c'},
        {'email': 'a@.c'},
        {'email': 'a b@c.d'},
        {'email': 'a@@b.c'},
        {'email': ' a@b.c'},
        {'email': 'a@b.c\n'},
        {'email': 'a@b.c', 'accepted': False},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'email': 'ada@example.com'},
        {'accepted': True},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
