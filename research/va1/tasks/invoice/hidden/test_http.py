import pytest
from fastapi.testclient import TestClient

OK = {"number": "INV-001", "subtotal": 10000, "tax": 800, "shipping": 500, "total": 11300}


def test_submits_an_invoice(client: TestClient) -> None:
    r = client.post("/invoices", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"number": "n"},
        {"number": "n" * 20},
        {"number": "\U0001f600" * 20},
        {"subtotal": 0, "total": 1300},
        {"tax": 0, "total": 10500},
        {"shipping": 0, "total": 10800},
        {"subtotal": 0, "tax": 0, "shipping": 0, "total": 0},
        {"subtotal": 1000000, "tax": 0, "shipping": 0, "total": 1000000},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/invoices", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"number": ""},
        {"number": "n" * 21},
        {"number": "\U0001f600" * 21},
        {"subtotal": -1, "total": 1299},
        {"tax": -1, "total": 10499},
        {"shipping": -1, "total": 10799},
        {"total": -1},
        {"total": 11301},
        {"total": 11299},
        {"total": 0},
        {"subtotal": 10001},
        {"tax": 801},
        {"shipping": 501},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/invoices", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "total"}
    assert client.post("/invoices", json=body).status_code == 422
