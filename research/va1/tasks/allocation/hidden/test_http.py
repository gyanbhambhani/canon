import pytest
from fastapi.testclient import TestClient

OK = {'ads': 40, 'dev': 35, 'ops': 25, 'project': 'Apollo'}
PATH = "/allocations"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'ads': 40, 'dev': 35, 'ops': 25, 'project': 'Apollo'}


@pytest.mark.parametrize(
    "change",
    [
        {'ads': 100, 'dev': 0, 'ops': 0},
        {'ads': 0, 'dev': 100, 'ops': 0},
        {'ads': 0, 'dev': 0, 'ops': 100},
        {'ads': 34, 'dev': 33, 'ops': 33},
        {'project': 'a'},
        {'project': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
        {'project': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'ads': -1, 'dev': 51, 'ops': 50},
        {'ads': 50, 'dev': -1, 'ops': 51},
        {'ads': 50, 'dev': 51, 'ops': -1},
        {'ads': 101, 'dev': 0, 'ops': -1},
        {'ads': 101, 'dev': 0, 'ops': 0},
        {'ads': 0, 'dev': 101, 'ops': 0},
        {'ads': 0, 'dev': 0, 'ops': 101},
        {'ads': 40, 'dev': 35, 'ops': 24},
        {'ads': 40, 'dev': 35, 'ops': 26},
        {'ads': 0, 'dev': 0, 'ops': 0},
        {'ads': 100, 'dev': 100, 'ops': 100},
        {'ads': 33, 'dev': 33, 'ops': 33},
        {'project': ''},
        {'project': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
        {'project': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'ads': 40, 'dev': 35, 'ops': 25},
        {'ads': 40, 'dev': 35, 'project': 'x'},
        {'dev': 35, 'ops': 25, 'project': 'x'},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
