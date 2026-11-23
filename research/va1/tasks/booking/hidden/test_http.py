import pytest
from fastapi.testclient import TestClient

OK = {"guest": "Ada", "start": 3, "end": 5}


def test_books_a_stay(client: TestClient) -> None:
    r = client.post("/bookings", json=OK)
    assert r.status_code == 200
    assert r.json() == {"guest": "Ada", "start": 3, "end": 5, "nights": 2}


@pytest.mark.parametrize(
    "change",
    [
        {"guest": "a" * 40},
        {"guest": " a "},
        {"start": 0, "end": 1},
        {"start": 365, "end": 366},
        {"end": 4},
        {"end": 33},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/bookings", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"guest": ""},
        {"guest": "   "},
        {"guest": "a" * 41},
        {"start": -1, "end": 0},
        {"start": 366, "end": 367},
        {"end": 3},
        {"end": 2},
        {"end": 34},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/bookings", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"
