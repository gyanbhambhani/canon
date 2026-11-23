import pytest
from fastapi.testclient import TestClient

OK = {'title': 'Crash on save', 'severity': 3, 'steps': ['open', 'edit', 'save']}
PATH = "/bugs"


def test_valid_request_is_echoed(client: TestClient) -> None:
    r = client.post(PATH, json=OK)
    assert r.status_code == 200
    assert r.json() == {'title': 'Crash on save', 'severity': 3, 'steps': ['open', 'edit', 'save']}


@pytest.mark.parametrize(
    "change",
    [
        {'title': 'aaaaa'},
        {'title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
        {'title': '😀😀😀😀😀'},
        {'title': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
        {'severity': 1},
        {'severity': 4},
        {'steps': []},
        {'steps': ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']},
        {'steps': ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']},
        {'steps': ['']},
    ],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "change",
    [
        {'title': 'aaaa'},
        {'title': ''},
        {'title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
        {'title': '😀😀😀😀'},
        {'title': '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀'},
        {'severity': 0},
        {'severity': 5},
        {'severity': -1},
        {'steps': ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']},
        {'steps': ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x']},
    ],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post(PATH, json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


@pytest.mark.parametrize(
    "body",
    [
        {'title': 'Crash on save', 'severity': 3},
        {'title': 'Crash on save', 'steps': []},
        {'severity': 3, 'steps': []},
    ],
)
def test_missing_field_is_422(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(PATH, json=body).status_code == 422
