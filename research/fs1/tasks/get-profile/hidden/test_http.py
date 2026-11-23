from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}


def test_get_profile(client: TestClient) -> None:
    client.post("/users", json={**ADA, "name": "  Ada Lovelace "})
    client.post("/users", json={**ADA, "email": "bob@example.com", "name": "Bob"})
    r = client.get("/users/ada@example.com")
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "name": "Ada Lovelace"}
    assert client.get("/users/bob@example.com").json() == {"email": "bob@example.com", "name": "Bob"}


def test_profile_unknown_user(client: TestClient) -> None:
    r = client.get("/users/nobody@example.com")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}
