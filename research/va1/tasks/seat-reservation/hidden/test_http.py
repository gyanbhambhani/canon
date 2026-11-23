import pytest
from fastapi.testclient import TestClient

OK = {"seats":3,"row":5,"first_seat":10}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/seats/reserve", json=OK)
    assert r.status_code == 200
    assert r.json() == {"seats":3,"row":5,"first_seat":10}


@pytest.mark.parametrize(
    "change",
    [
        {"seats":1,"first_seat":1},
        {"seats":10,"first_seat":11},
        {"seats":1,"first_seat":20},
        {"row":1},
        {"row":30},
        {"seats":3,"first_seat":18},
        {"seats":2,"first_seat":19},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/seats/reserve", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"seats":0},
        {"seats":11,"first_seat":1},
        {"row":0},
        {"row":31},
        {"first_seat":0},
        {"seats":1,"first_seat":21},
        {"seats":10,"first_seat":12},
        {"seats":5,"first_seat":17},
        {"seats":2,"first_seat":20},
        {"seats":-1},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/seats/reserve", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "seats"}
    assert client.post("/seats/reserve", json=body).status_code == 422
