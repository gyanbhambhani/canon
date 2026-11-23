from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
CREDENTIALS = {"email": "ada@example.com", "password": "correct horse"}


def test_login_without_name(client: TestClient) -> None:
    client.post("/users", json={**ADA, "name": " Ada Lovelace "})
    r = client.post("/login", json=CREDENTIALS)
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "name": "Ada Lovelace"}


def test_login_ignores_other_fields(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.post("/login", json={**CREDENTIALS, "name": "Somebody Else", "remember": True})
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "name": "Ada"}


def test_bad_login(client: TestClient) -> None:
    client.post("/users", json=ADA)
    for body in [{**CREDENTIALS, "password": "wrong password"}, {**CREDENTIALS, "email": "bob@example.com"}]:
        r = client.post("/login", json=body)
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "BadLogin"}}


def test_login_body_needs_email_and_password(client: TestClient) -> None:
    client.post("/users", json=ADA)
    for body in [{"email": "ada@example.com"}, {"password": "correct horse"}, {}]:
        r = client.post("/login", json=body)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
