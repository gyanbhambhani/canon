import pytest
from fastapi.testclient import TestClient

OK = {'width': 4, 'height': 5, 'label': 'desk'}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/rectangles", json=OK)
    assert r.status_code == 200
    assert r.json() == {'width': 4, 'height': 5, 'label': 'desk', 'area': 20}


@pytest.mark.parametrize(
    "change",
    [{'width': 1}, {'height': 1}, {'width': 100, 'height': 100}, {'width': 1, 'height': 10000}, {'width': 10000, 'height': 1}, {'label': ''}, {'label': 'aaaaaaaaaaaaaaaaaaaa'}, {'label': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/rectangles", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'width': 0}, {'width': -1}, {'height': 0}, {'height': -1}, {'width': 100, 'height': 101}, {'width': 101, 'height': 100}, {'width': 1, 'height': 10001}, {'width': 2, 'height': 5001}, {'label': 'aaaaaaaaaaaaaaaaaaaaa'}, {'label': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/rectangles", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/rectangles", json={first: OK[first]}).status_code == 422
