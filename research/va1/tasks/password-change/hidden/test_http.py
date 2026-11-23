import pytest
from fastapi.testclient import TestClient

OK = {'old_password': 'hunter2', 'new_password': 'correct-horse', 'confirm': 'correct-horse'}


def test_valid_request(client: TestClient) -> None:
    r = client.post("/password", json=OK)
    assert r.status_code == 200
    assert r.json() == {'changed': True}


@pytest.mark.parametrize(
    "change",
    [{'old_password': 'x'}, {'old_password': ' '}, {'new_password': 'pppppppp', 'confirm': 'pppppppp'}, {'new_password': 'pppppppppppppppppppppppppppppppppppppppp', 'confirm': 'pppppppppppppppppppppppppppppppppppppppp'}, {'new_password': 'Hunter22', 'confirm': 'Hunter22'}, {'old_password': 'qqqqqqqq', 'new_password': 'QQQQQQQQ', 'confirm': 'QQQQQQQQ'}, {'old_password': 'qqqqqqqq', 'new_password': 'qqqqqqqqq', 'confirm': 'qqqqqqqqq'}],
)
def test_edges_are_valid(client: TestClient, change: dict[str, object]) -> None:
    assert client.post("/password", json={**OK, **change}).status_code == 200


@pytest.mark.parametrize(
    "change",
    [{'old_password': ''}, {'new_password': 'ppppppp', 'confirm': 'ppppppp'}, {'new_password': '', 'confirm': ''}, {'confirm': 'correct-horsE'}, {'confirm': 'correct-hors'}, {'confirm': 'correct-horse '}, {'confirm': ''}, {'old_password': 'qqqqqqqq', 'new_password': 'qqqqqqqq', 'confirm': 'qqqqqqqq'}, {'old_password': 'correct-horse'}],
)
def test_rule_breaks_are_422(client: TestClient, change: dict[str, object]) -> None:
    r = client.post("/password", json={**OK, **change})
    assert r.status_code == 422
    assert r.json()["error"]["kind"] == "ValidationError"


def test_missing_field_is_422(client: TestClient) -> None:
    first = next(iter(OK))
    assert client.post("/password", json={first: OK[first]}).status_code == 422
