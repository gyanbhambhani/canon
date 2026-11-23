from fastapi.testclient import TestClient


def signup(client: TestClient, email: str, name: str) -> None:
    r = client.post("/users", json={"email": email, "name": name, "password": "correct horse"})
    assert r.status_code == 200


def emails(r: object) -> list[str]:
    return [p["email"] for p in r.json()]  # type: ignore[attr-defined]


def test_search_users(client: TestClient) -> None:
    signup(client, "grace@example.com", "Grace Hopper")
    signup(client, "ada@example.com", "Ada Lovelace")
    signup(client, "ace@example.com", "Acey")
    signup(client, "bob@example.com", "Bob")
    r = client.get("/users/search", params={"q": "ace"})
    assert r.status_code == 200
    assert r.json() == [
        {"email": "ada@example.com", "name": "Ada Lovelace"},
        {"email": "grace@example.com", "name": "Grace Hopper"},
    ]
    assert emails(client.get("/users/search", params={"q": "  Ac "})) == ["ace@example.com"]
    assert emails(client.get("/users/search", params={"q": "grace"})) == []
    assert emails(client.get("/users/search", params={"q": "e Ho"})) == ["grace@example.com"]
    assert emails(client.get("/users/search", params={"q": "Bob"})) == ["bob@example.com"]
    assert client.get("/users/search", params={"q": "zz"}).json() == []


def test_search_validation(client: TestClient) -> None:
    signup(client, "ada@example.com", "Ada")
    for q in ["", "A", "   ", " A  "]:
        r = client.get("/users/search", params={"q": q})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    r = client.get("/users/search")
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/users/search", params={"q": "Ad"}).status_code == 200
