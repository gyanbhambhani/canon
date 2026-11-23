import pytest
from fastapi.testclient import TestClient

OK = {"from_account": "alice", "to_account": "bob", "amount": 300, "balance": 1000}


def test_makes_a_transfer(client: TestClient) -> None:
    r = client.post("/transfers", json=OK)
    assert r.status_code == 200
    assert r.json() == {**OK, "remaining": 700}


def test_whole_balance_leaves_nothing(client: TestClient) -> None:
    r = client.post("/transfers", json={**OK, "amount": 1000})
    assert r.status_code == 200
    assert r.json()["remaining"] == 0


@pytest.mark.parametrize(
    "change",
    [
        {"from_account": "a"},
        {"from_account": "a" * 20},
        {"from_account": "\U0001f600" * 20},
        {"to_account": "b"},
        {"to_account": "b" * 20},
        {"to_account": "\U0001f600" * 20},
        {"to_account": "ALICE"},
        {"to_account": "alice2"},
        {"amount": 1},
        {"amount": 1000},
        {"amount": 1, "balance": 1},
        {"balance": 300},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/transfers", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"from_account": ""},
        {"from_account": "a" * 21},
        {"from_account": "\U0001f600" * 21},
        {"to_account": ""},
        {"to_account": "b" * 21},
        {"to_account": "\U0001f600" * 21},
        {"to_account": "alice"},
        {"from_account": "same", "to_account": "same"},
        {"amount": 0},
        {"amount": -1},
        {"amount": 1001},
        {"amount": 5000},
        {"balance": 299},
        {"balance": -1, "amount": 1},
        {"balance": 0},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/transfers", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "balance"}
    assert client.post("/transfers", json=body).status_code == 422
