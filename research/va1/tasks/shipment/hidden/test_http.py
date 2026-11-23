import pytest
from fastapi.testclient import TestClient

OK = {'weight_g': 1500, 'length': 40, 'width': 30, 'height': 20}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/shipments", json=OK)
    assert r.status_code == 200
    assert r.json() == {'weight_g': 1500, 'length': 40, 'width': 30, 'height': 20}


@pytest.mark.parametrize(
    "change",
    [{'weight_g': 1}, {'weight_g': 30000}, {'length': 1}, {'length': 200, 'width': 1, 'height': 1}, {'width': 1}, {'width': 100, 'height': 1, 'length': 1}, {'height': 1}, {'height': 100, 'width': 1, 'length': 1}, {'length': 100, 'width': 50, 'height': 50}, {'length': 200, 'width': 25, 'height': 25}, {'length': 2, 'width': 100, 'height': 49}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/shipments", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'weight_g': 0}, {'weight_g': 30001}, {'weight_g': -1}, {'length': 0}, {'length': 201, 'width': 1, 'height': 1}, {'width': 0}, {'width': 101, 'height': 1, 'length': 1}, {'height': 0}, {'height': 101, 'width': 1, 'length': 1}, {'length': 101, 'width': 50, 'height': 50}, {'length': 200, 'width': 26, 'height': 25}, {'length': 2, 'width': 100, 'height': 50}, {'length': 1, 'width': 100, 'height': 100}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/shipments", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/shipments", json={first: OK[first]}).status_code == 422
