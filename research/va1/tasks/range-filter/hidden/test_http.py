import pytest
from fastapi.testclient import TestClient

OK = {"min_price": 100, "max_price": 900, "category": "food"}


def test_filters_by_price(client: TestClient) -> None:
    r = client.post("/filters/price", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"min_price": 0},
        {"min_price": 0, "max_price": 0},
        {"min_price": 0, "max_price": 1},
        {"max_price": 100},
        {"min_price": 900},
        {"category": "drink"},
        {"category": "tool"},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/filters/price", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"min_price": -1},
        {"max_price": -1},
        {"min_price": -1, "max_price": -1},
        {"max_price": 99},
        {"min_price": 901},
        {"min_price": 5000},
        {"category": "Food"},
        {"category": "TOOL"},
        {"category": "tool "},
        {"category": "toys"},
        {"category": ""},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/filters/price", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/filters/price", json={"min_price": 1, "category": "food"}).status_code == 422
