import pytest
from fastapi.testclient import TestClient

OK = {"name":"Apollo"}


def test_accepts_a_valid_request(client: TestClient) -> None:
    r = client.post("/projects/rename", json=OK)
    assert r.status_code == 200
    assert r.json() == {"name":"Apollo"}


@pytest.mark.parametrize(
    "change",
    [
        {"name":"abc"},
        {"name":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
        {"name":"😀😀😀"},
        {"name":"a b"},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/projects/rename", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {"name":"ab"},
        {"name":""},
        {"name":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
        {"name":"😀😀"},
        {"name":"😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀"},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/projects/rename", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    body = {k: v for k, v in OK.items() if k != "name"}
    assert client.post("/projects/rename", json=body).status_code == 422
