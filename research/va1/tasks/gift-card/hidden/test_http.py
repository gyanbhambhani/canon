import pytest
from fastapi.testclient import TestClient

OK = {"code": "ABCD1234", "amount": 50, "currency": "EUR"}


def test_registers_a_card(client: TestClient) -> None:
    r = client.post("/gift-cards", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"code": "A" * 8},
        {"code": "A" * 12},
        {"amount": 5},
        {"amount": 500},
        {"currency": "USD"},
        {"currency": "GBP"},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/gift-cards", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"code": "A" * 7},
        {"code": "A" * 13},
        {"code": ""},
        {"amount": 4},
        {"amount": 501},
        {"currency": "usd"},
        {"currency": "JPY"},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/gift-cards", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/gift-cards", json={"code": "ABCD1234"}).status_code == 422
