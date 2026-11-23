import pytest
from fastapi.testclient import TestClient

OK = {'interval_days': 7, 'occurrences': 10, 'title': 'Standup'}
PATH = "/events/recurring"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'interval_days': 7, 'occurrences': 10, 'title': 'Standup', 'span_days': 70}


@pytest.mark.parametrize(
    "change",
    [
        {'interval_days': 1, 'occurrences': 1},
        {'interval_days': 365, 'occurrences': 1},
        {'interval_days': 1, 'occurrences': 52},
        {'interval_days': 7, 'occurrences': 52},
        {'interval_days': 73, 'occurrences': 5},
        {'interval_days': 364, 'occurrences': 1},
        {'interval_days': 182, 'occurrences': 2},
        {'title': ' a '},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'interval_days': 0},
        {'interval_days': -1},
        {'interval_days': 366, 'occurrences': 1},
        {'occurrences': 0},
        {'occurrences': -1},
        {'interval_days': 1, 'occurrences': 53},
        {'interval_days': 74, 'occurrences': 5},
        {'interval_days': 183, 'occurrences': 2},
        {'interval_days': 8, 'occurrences': 46},
        {'interval_days': 365, 'occurrences': 2},
        {'interval_days': 52, 'occurrences': 8},
        {'title': ''},
        {'title': ' '},
        {'title': '\t \r\n'},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'interval_days': 7, 'occurrences': 10},
        {'interval_days': 7, 'title': 'x'},
        {'occurrences': 10, 'title': 'x'},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
