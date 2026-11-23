import pytest
from fastapi.testclient import TestClient

OK = {'size': 25, 'sort': 'asc'}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/settings/paging", json=OK)
    assert r.status_code == 200
    assert r.json() == {'size': 25, 'sort': 'asc'}


@pytest.mark.parametrize(
    "change",
    [{'size': 10}, {'size': 100}, {'sort': 'desc'}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/settings/paging", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'size': 9}, {'size': 101}, {'size': 0}, {'size': -1}, {'sort': 'ASC'}, {'sort': 'up'}, {'sort': 'asc '}, {'sort': ''}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/settings/paging", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/settings/paging", json={first: OK[first]}).status_code == 422
