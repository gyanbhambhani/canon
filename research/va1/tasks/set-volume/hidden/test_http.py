import pytest
from fastapi.testclient import TestClient

OK = {"level":40}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/volume", json=OK)
    assert r.status_code == 200
    assert r.json() == {"level":40}


@pytest.mark.parametrize(
    "change",
    [
        {"level":0},
        {"level":100},
        {"level":1},
        {"level":99},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/volume", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"level":-1},
        {"level":101},
        {"level":-100},
        {"level":1000},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/volume", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "level"}
    assert client.post("/volume", json=body).status_code == 422
