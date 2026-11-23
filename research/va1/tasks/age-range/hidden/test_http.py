import pytest
from fastapi.testclient import TestClient

OK = {'min_age': 18, 'max_age': 65, 'title': 'Adults'}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/events/ages", json=OK)
    assert r.status_code == 200
    assert r.json() == {'min_age': 18, 'max_age': 65, 'title': 'Adults'}


@pytest.mark.parametrize(
    "change",
    [{'min_age': 0}, {'min_age': 120, 'max_age': 120}, {'max_age': 120}, {'min_age': 0, 'max_age': 0}, {'min_age': 50, 'max_age': 50}, {'title': 'a'}, {'title': ' a '}, {'title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}, {'title': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/events/ages", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'min_age': -1}, {'min_age': 121, 'max_age': 121}, {'max_age': 121}, {'min_age': 0, 'max_age': -1}, {'min_age': 50, 'max_age': 49}, {'min_age': 120, 'max_age': 119}, {'min_age': 1, 'max_age': 0}, {'title': ''}, {'title': '   '}, {'title': '\t\r\n'}, {'title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}, {'title': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/events/ages", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/events/ages", json={first: OK[first]}).status_code == 422
