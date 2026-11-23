import pytest
from fastapi.testclient import TestClient

OK = {"code": "SAVE10", "subtotal": 5000, "discount": 1000}


def test_applies_a_coupon(client: TestClient) -> None:
    r = client.post("/coupons/apply", json=OK)
    assert r.status_code == 200
    assert r.json() == {"code": "SAVE10", "subtotal": 5000, "discount": 1000, "payable": 4000}


def test_full_discount_pays_nothing(client: TestClient) -> None:
    r = client.post("/coupons/apply", json={**OK, "discount": 5000})
    assert r.status_code == 200
    assert r.json()["payable"] == 0


def test_zero_discount_pays_the_subtotal(client: TestClient) -> None:
    r = client.post("/coupons/apply", json={**OK, "discount": 0})
    assert r.status_code == 200
    assert r.json()["payable"] == 5000


@pytest.mark.parametrize(
    "change",
    [
        {"code": "abc"},
        {"code": "c" * 20},
        {"code": "\U0001f600" * 3},
        {"subtotal": 1, "discount": 0},
        {"subtotal": 1, "discount": 1},
        {"discount": 0},
        {"discount": 5000},
        {"subtotal": 7, "discount": 6},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/coupons/apply", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"code": ""},
        {"code": "ab"},
        {"code": "c" * 21},
        {"code": "\U0001f600" * 21},
        {"subtotal": 0, "discount": 0},
        {"subtotal": -1, "discount": 0},
        {"discount": -1},
        {"discount": 5001},
        {"discount": 6000},
        {"subtotal": 1, "discount": 2},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/coupons/apply", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/coupons/apply", json={"code": "SAVE10", "subtotal": 5000}).status_code == 422
