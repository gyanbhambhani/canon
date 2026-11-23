import pytest
from fastapi.testclient import TestClient

OK = {"temperature": 21, "mode": "comfort"}


def test_sets_the_thermostat(client: TestClient) -> None:
    r = client.post("/thermostat", json=OK)
    assert r.status_code == 200
    assert r.json() == OK


@pytest.mark.parametrize(
    "change",
    [
        {"temperature": 10},
        {"temperature": 30},
        {"mode": "eco"},
        {"mode": "away"},
        {"mode": "comfort"},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/thermostat", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"temperature": 9},
        {"temperature": 31},
        {"temperature": 0},
        {"temperature": -10},
        {"mode": "Eco"},
        {"mode": "AWAY"},
        {"mode": "eco "},
        {"mode": "boost"},
        {"mode": ""},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/thermostat", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    assert client.post("/thermostat", json={"temperature": 20}).status_code == 422
