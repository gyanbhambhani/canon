import pytest
from fastapi.testclient import TestClient

OK = {'name': 'Ada', 'email': 'ada@example.com', 'phone': '5551234567'}
PATH = "/contacts"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'name': 'Ada', 'email': 'ada@example.com', 'phone': '5551234567'}


@pytest.mark.parametrize(
    "change",
    [
        {'email': '', 'phone': '5551234'},
        {'email': '', 'phone': '555555555555555'},
        {'phone': ''},
        {'phone': '5555555'},
        {'phone': '555555555555555'},
        {'phone': '😀😀😀😀😀😀😀'},
        {'phone': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
        {'email': 'a@b.c', 'phone': ''},
        {'name': 'a'},
        {'name': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
        {'name': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'email': '', 'phone': ''},
        {'email': 'plain'},
        {'email': 'a@b'},
        {'email': 'a@b.'},
        {'email': 'a b@c.d'},
        {'email': ' '},
        {'email': 'plain', 'phone': ''},
        {'phone': '555555'},
        {'phone': '5555555555555555'},
        {'phone': '1'},
        {'phone': ' '},
        {'phone': '😀😀😀😀😀😀'},
        {'phone': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
        {'email': '', 'phone': '555555'},
        {'name': ''},
        {'name': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
        {'name': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'name': 'Ada', 'email': 'ada@example.com'},
        {'name': 'Ada', 'phone': '5551234567'},
        {'email': 'ada@example.com', 'phone': '5551234567'},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
