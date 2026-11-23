import pytest
from fastapi.testclient import TestClient

OK = {"principal":12000,"months":12,"monthly_payment":1000}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/loans", json=OK)
    assert r.status_code == 200
    assert r.json() == {"principal":12000,"months":12,"monthly_payment":1000}


@pytest.mark.parametrize(
    "change",
    [
        {"principal":1000,"months":6,"monthly_payment":167},
        {"principal":1000000,"months":360,"monthly_payment":2778},
        {"principal":6000,"months":6,"monthly_payment":1000},
        {"monthly_payment":1000000},
        {"months":6,"monthly_payment":2000},
        {"months":360,"monthly_payment":34},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/loans", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"principal":999},
        {"principal":1000001,"monthly_payment":1000000},
        {"principal":0},
        {"months":5,"monthly_payment":5000},
        {"months":361},
        {"months":0},
        {"monthly_payment":0},
        {"monthly_payment":-1},
        {"monthly_payment":1000001},
        {"monthly_payment":999},
        {"principal":6001,"months":6,"monthly_payment":1000},
        {"principal":1000,"months":6,"monthly_payment":1},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/loans", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "principal"}
    assert client.post("/loans", json=body).status_code == 422
