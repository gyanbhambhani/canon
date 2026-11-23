import pytest
from fastapi.testclient import TestClient

OK = {"filename":"photo.png","size_kb":512,"kind":"png"}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/uploads", json=OK)
    assert r.status_code == 200
    assert r.json() == {"filename":"photo.png","size_kb":512,"kind":"png"}


@pytest.mark.parametrize(
    "change",
    [
        {"filename":"a"},
        {"filename":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
        {"filename":"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀"},
        {"size_kb":1},
        {"size_kb":10240},
        {"kind":"jpg"},
        {"kind":"pdf"},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/uploads", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"filename":""},
        {"filename":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
        {"filename":"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀"},
        {"size_kb":0},
        {"size_kb":10241},
        {"size_kb":-1},
        {"kind":"PNG"},
        {"kind":"gif"},
        {"kind":"png "},
        {"kind":""},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/uploads", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "filename"}
    assert client.post("/uploads", json=body).status_code == 422
