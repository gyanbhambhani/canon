import pytest
from fastapi.testclient import TestClient

OK = {'low': 10, 'high': 20, 'label': 'mild'}
PATH = "/bands"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'low': 10, 'high': 20, 'label': 'mild'}


@pytest.mark.parametrize(
    "change",
    [
        {'low': -50, 'high': -48},
        {'low': 48, 'high': 50},
        {'low': 0, 'high': 2},
        {'low': -50, 'high': 50},
        {'low': 10, 'high': 12},
        {'label': ''},
        {'label': 'aaaaaaaaaaaaaaaaaaaa'},
        {'label': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
        {'label': ' '},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'low': -51, 'high': 0},
        {'low': -51, 'high': -49},
        {'low': 51, 'high': 53},
        {'low': 0, 'high': 51},
        {'low': 10, 'high': 60},
        {'low': 10, 'high': 11},
        {'low': 10, 'high': 10},
        {'low': 10, 'high': 9},
        {'low': 10, 'high': -10},
        {'low': 48, 'high': 49},
        {'low': 0, 'high': 1},
        {'label': 'aaaaaaaaaaaaaaaaaaaaa'},
        {'label': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'low': 10, 'high': 20},
        {'low': 10, 'label': 'x'},
        {'high': 20, 'label': 'x'},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
