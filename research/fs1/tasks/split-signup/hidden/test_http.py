import re

from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def register(client: TestClient, body: dict[str, str]) -> str:
    r = client.post("/users", json=body)
    assert r.status_code == 200
    assert set(r.json()) == {"email", "token"} and r.json()["email"] == body["email"]
    token: str = r.json()["token"]
    assert UUID.fullmatch(token.lower()), token
    return token


def test_register_then_confirm(client: TestClient) -> None:
    token = register(client, {**ADA, "name": " Ada "})
    r = client.post("/login", json=ADA)
    assert r.status_code == 400 and r.json() == {"error": {"kind": "NotConfirmed"}}
    r = client.post("/users/confirm", json={"token": token})
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada"}
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/login", json={**ADA, "password": "wrong password"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadLogin"}}


def test_pending_account(client: TestClient) -> None:
    register(client, ADA)
    r = client.post("/login", json={**ADA, "password": "wrong password"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadLogin"}}
    r = client.post("/login", json={**ADA, "email": "nobody@example.com"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadLogin"}}
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    assert client.get("/customers").json() == [["Ada", 0]]


def test_tokens_work_once(client: TestClient) -> None:
    ada = register(client, ADA)
    bob = register(client, {**ADA, "email": "bob@example.com", "name": "Bob"})
    assert ada != bob
    assert client.post("/users/confirm", json={"token": bob}).json() == {"email": "bob@example.com", "name": "Bob"}
    r = client.post("/users/confirm", json={"token": bob})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadToken"}}
    r = client.post("/users/confirm", json={"token": "no-such-token"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadToken"}}
    # ada is still pending
    assert client.post("/login", json=ADA).json() == {"error": {"kind": "NotConfirmed"}}
    assert client.post("/users/confirm", json={"token": ada}).status_code == 200


def test_register_validation(client: TestClient) -> None:
    for bad in [{**ADA, "email": "ada"}, {**ADA, "name": "   "}, {**ADA, "password": "short"}]:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
