import pytest
from fastapi.testclient import TestClient

OK = {"percent":10,"fixed_cents":0,"name":"Spring sale"}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/discounts", json=OK)
    assert r.status_code == 200
    assert r.json() == {"percent":10,"fixed_cents":0,"name":"Spring sale"}


@pytest.mark.parametrize(
    "change",
    [
        {"percent":100},
        {"percent":0,"fixed_cents":1},
        {"percent":0,"fixed_cents":100000},
        {"percent":1},
        {"name":"a"},
        {"name":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
        {"name":"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀"},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/discounts", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"percent":101},
        {"percent":-1,"fixed_cents":5},
        {"percent":0,"fixed_cents":100001},
        {"percent":0,"fixed_cents":-1},
        {"percent":0,"fixed_cents":0},
        {"percent":10,"fixed_cents":500},
        {"percent":100,"fixed_cents":100000},
        {"name":""},
        {"name":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
        {"name":"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀"},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/discounts", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "percent"}
    assert client.post("/discounts", json=body).status_code == 422
