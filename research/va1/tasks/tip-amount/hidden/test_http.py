import pytest
from fastapi.testclient import TestClient

OK = {'amount': 12.5, 'percent': 15}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/tips", json=OK)
    assert r.status_code == 200
    assert r.json() == {'amount': 12.5, 'percent': 15}


@pytest.mark.parametrize(
    "change",
    [{'amount': 0.01}, {'amount': 0.02}, {'amount': 9999.99}, {'amount': 10000.0}, {'percent': 0}, {'percent': 100}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/tips", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'amount': 0.0}, {'amount': -0.01}, {'amount': 10000.01}, {'amount': -5.0}, {'percent': -1}, {'percent': 101}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/tips", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/tips", json={first: OK[first]}).status_code == 422
