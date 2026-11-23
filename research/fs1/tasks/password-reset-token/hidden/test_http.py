import re

from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def issue(client: TestClient, email: str = "ada@example.com") -> str:
    r = client.post(f"/users/{email}/reset")
    assert r.status_code == 200 and set(r.json()) == {"token"}
    token: str = r.json()["token"]
    assert UUID.fullmatch(token.lower()), token
    return token


def test_reset_password(client: TestClient) -> None:
    client.post("/users", json=ADA)
    token = issue(client)
    r = client.post("/password-resets", json={"token": token, "new_password": "battery staple"})
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada"}
    assert client.post("/login", json={**ADA, "password": "battery staple"}).status_code == 200
    r = client.post("/login", json=ADA)
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadLogin"}}


def test_token_works_once(client: TestClient) -> None:
    client.post("/users", json=ADA)
    first, second = issue(client), issue(client)
    assert first != second
    assert client.post("/password-resets", json={"token": first, "new_password": "battery staple"}).status_code == 200
    r = client.post("/password-resets", json={"token": first, "new_password": "another secret"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadToken"}}
    assert client.post("/login", json={**ADA, "password": "battery staple"}).status_code == 200
    # the other token still works
    r = client.post("/password-resets", json={"token": second, "new_password": "third password"})
    assert r.status_code == 200
    assert client.post("/login", json={**ADA, "password": "third password"}).status_code == 200


def test_reset_errors(client: TestClient) -> None:
    r = client.post("/users/nobody@example.com/reset")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}
    r = client.post("/password-resets", json={"token": "no-such-token", "new_password": "battery staple"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadToken"}}


def test_new_password_rule(client: TestClient) -> None:
    client.post("/users", json=ADA)
    token = issue(client)
    for bad in ["", "short", "seven77"]:
        r = client.post("/password-resets", json={"token": token, "new_password": bad})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # validation comes before the token is looked up
    r = client.post("/password-resets", json={"token": "no-such-token", "new_password": "short"})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # a rejected request does not use up the token
    assert client.post("/password-resets", json={"token": token, "new_password": "eight888"}).status_code == 200
