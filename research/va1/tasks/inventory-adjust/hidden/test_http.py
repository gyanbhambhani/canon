import pytest
from fastapi.testclient import TestClient

OK = {"on_hand":10,"remove":3,"reason":"sold"}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/inventory/remove", json=OK)
    assert r.status_code == 200
    assert r.json() == {"on_hand":10,"remove":3,"reason":"sold","left":7}


@pytest.mark.parametrize(
    "change",
    [
        {"on_hand":100000,"remove":1},
        {"remove":1},
        {"remove":10},
        {"on_hand":1,"remove":1},
        {"reason":"lost"},
        {"reason":"damaged"},
        {"on_hand":100000,"remove":100000},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/inventory/remove", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"on_hand":100001},
        {"remove":0},
        {"remove":-1},
        {"remove":11},
        {"on_hand":0,"remove":1},
        {"on_hand":-1,"remove":1},
        {"reason":"Sold"},
        {"reason":"stolen"},
        {"reason":"lost "},
        {"reason":""},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/inventory/remove", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "on_hand"}
    assert client.post("/inventory/remove", json=body).status_code == 422
