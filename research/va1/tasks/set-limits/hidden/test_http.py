import pytest
from fastapi.testclient import TestClient

OK = {'daily': 100, 'monthly': 3000}
PATH = "/limits"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'daily': 100, 'monthly': 3000}


@pytest.mark.parametrize(
    "change",
    [
        {'daily': 1},
        {'daily': 1000},
        {'monthly': 1},
        {'monthly': 31000},
        {'daily': 1000, 'monthly': 1},
        {'daily': 2, 'monthly': 30999},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'daily': 0},
        {'daily': 1001},
        {'daily': -1},
        {'monthly': 0},
        {'monthly': 31001},
        {'monthly': -100},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'daily': 100},
        {'monthly': 3000},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
