import pytest
from fastapi.testclient import TestClient

OK = {"label":"urgent","color":"red"}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/tags", json=OK)
    assert r.status_code == 200
    assert r.json() == {"label":"urgent","color":"red"}


@pytest.mark.parametrize(
    "change",
    [
        {"label":"ab"},
        {"label":"aaaaaaaaaaaaaaaaaaaa"},
        {"label":"😀😀"},
        {"color":"green"},
        {"color":"blue"},
        {"color":"gray"},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/tags", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"label":"a"},
        {"label":""},
        {"label":"aaaaaaaaaaaaaaaaaaaaa"},
        {"label":"😀"},
        {"label":"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀"},
        {"color":"grey"},
        {"color":"Red"},
        {"color":"red "},
        {"color":""},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/tags", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "label"}
    assert client.post("/tags", json=body).status_code == 422
