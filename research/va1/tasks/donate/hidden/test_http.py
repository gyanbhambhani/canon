import pytest
from fastapi.testclient import TestClient

OK = {'amount': 50.25, 'currency': 'EUR', 'anonymous': False}
PATH = "/donations"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'amount': 50.25, 'currency': 'EUR', 'anonymous': False}


@pytest.mark.parametrize(
    "change",
    [
        {'amount': 1.0},
        {'amount': 1},
        {'amount': 5000.0},
        {'amount': 5000},
        {'amount': 1.01},
        {'amount': 4999.99},
        {'currency': 'USD'},
        {'anonymous': True},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'amount': 0.99},
        {'amount': 0},
        {'amount': -5.5},
        {'amount': 5000.01},
        {'amount': 5001},
        {'currency': 'usd'},
        {'currency': 'GBP'},
        {'currency': 'EUR '},
        {'currency': ''},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'amount': 10.5, 'currency': 'USD'},
        {'currency': 'USD', 'anonymous': True},
        {'amount': 10.5, 'anonymous': True},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
