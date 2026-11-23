"""The starter's behavior (visible to agents, and part of every hidden run)."""

from fastapi.testclient import TestClient


def test_ping(client: TestClient) -> None:
    r = client.get("/ping")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_unknown_route_is_404(client: TestClient) -> None:
    assert client.get("/no-such-route").status_code == 404
