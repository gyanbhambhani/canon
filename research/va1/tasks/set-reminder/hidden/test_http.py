import pytest
from fastapi.testclient import TestClient

OK = {'minutes_before': 30, 'channel': 'sms'}
PATH = "/reminders"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'minutes_before': 30, 'channel': 'sms'}


@pytest.mark.parametrize(
    "change",
    [
        {'minutes_before': 5},
        {'minutes_before': 1440},
        {'minutes_before': 6},
        {'minutes_before': 1439},
        {'channel': 'email'},
        {'channel': 'push'},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'minutes_before': 4},
        {'minutes_before': 1441},
        {'minutes_before': 0},
        {'minutes_before': -30},
        {'channel': 'Email'},
        {'channel': 'pager'},
        {'channel': 'sms '},
        {'channel': ''},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'minutes_before': 30},
        {'channel': 'sms'},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
