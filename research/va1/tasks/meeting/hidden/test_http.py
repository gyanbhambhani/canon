import pytest
from fastapi.testclient import TestClient

OK = {'title': 'Standup', 'start_hour': 9, 'duration_min': 30}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/meetings", json=OK)
    assert r.status_code == 200
    assert r.json() == {'title': 'Standup', 'start_hour': 9, 'duration_min': 30}


@pytest.mark.parametrize(
    "change",
    [{'start_hour': 0}, {'start_hour': 23, 'duration_min': 60}, {'start_hour': 0, 'duration_min': 15}, {'start_hour': 0, 'duration_min': 240}, {'duration_min': 45}, {'start_hour': 20, 'duration_min': 240}, {'start_hour': 22, 'duration_min': 120}, {'title': 'a'}, {'title': ' '}, {'title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}, {'title': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/meetings", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'start_hour': -1}, {'start_hour': 24, 'duration_min': 15}, {'start_hour': 0, 'duration_min': 0}, {'start_hour': 0, 'duration_min': -15}, {'start_hour': 0, 'duration_min': 255}, {'start_hour': 0, 'duration_min': 16}, {'start_hour': 0, 'duration_min': 31}, {'start_hour': 0, 'duration_min': 239}, {'start_hour': 23, 'duration_min': 75}, {'start_hour': 22, 'duration_min': 135}, {'start_hour': 21, 'duration_min': 240}, {'title': ''}, {'title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}, {'title': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/meetings", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/meetings", json={first: OK[first]}).status_code == 422
