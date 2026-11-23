import pytest
from fastapi.testclient import TestClient

OK = {'party_size': 4, 'name': 'Ada'}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/tables/book", json=OK)
    assert r.status_code == 200
    assert r.json() == {'party_size': 4, 'name': 'Ada'}


@pytest.mark.parametrize(
    "change",
    [{'party_size': 1}, {'party_size': 12}, {'name': 'a'}, {'name': ' a '}, {'name': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}, {'name': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/tables/book", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'party_size': 0}, {'party_size': 13}, {'party_size': -1}, {'name': ''}, {'name': '   '}, {'name': '\t\r\n'}, {'name': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}, {'name': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/tables/book", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/tables/book", json={first: OK[first]}).status_code == 422
