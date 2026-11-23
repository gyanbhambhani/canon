import pytest
from fastapi.testclient import TestClient

OK = {"from_day":5,"to_day":10,"granularity":"day"}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/reports/range", json=OK)
    assert r.status_code == 200
    assert r.json() == {"from_day":5,"to_day":10,"granularity":"day"}


@pytest.mark.parametrize(
    "change",
    [
        {"from_day":1,"to_day":1},
        {"from_day":31,"to_day":31},
        {"from_day":1,"to_day":15,"granularity":"day"},
        {"from_day":1,"to_day":31,"granularity":"week"},
        {"granularity":"week"},
        {"from_day":17,"to_day":31,"granularity":"day"},
        {"from_day":5,"to_day":5},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/reports/range", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"from_day":0},
        {"from_day":-1},
        {"from_day":32,"to_day":32,"granularity":"week"},
        {"to_day":32,"granularity":"week"},
        {"to_day":4},
        {"from_day":31,"to_day":30},
        {"from_day":1,"to_day":16,"granularity":"day"},
        {"from_day":1,"to_day":31,"granularity":"day"},
        {"from_day":10,"to_day":25,"granularity":"day"},
        {"granularity":"Day"},
        {"granularity":"month"},
        {"granularity":"week "},
        {"granularity":""},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/reports/range", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "from_day"}
    assert client.post("/reports/range", json=body).status_code == 422
