from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
CHANGE = {"old_password": "correct horse", "new_password": "battery staple"}


def test_change_password(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.post("/users/ada@example.com/password", json=CHANGE)
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/login", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}
    r = client.post("/login", json={**ADA, "password": "battery staple"})
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada"}


def test_wrong_old_password(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.post("/users/ada@example.com/password", json={**CHANGE, "old_password": "not my password"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "WrongPassword"}}
    assert client.post("/login", json=ADA).status_code == 200


def test_change_password_unknown_user(client: TestClient) -> None:
    r = client.post("/users/nobody@example.com/password", json=CHANGE)
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}


def test_new_password_rules(client: TestClient) -> None:
    client.post("/users", json=ADA)
    for bad in [
        {**CHANGE, "new_password": "short"},
        {**CHANGE, "new_password": "1234567"},
        {**CHANGE, "new_password": "correct horse"},
        {"old_password": "correct horse"},
    ]:
        r = client.post("/users/ada@example.com/password", json=bad)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # validation comes before the user and password checks
    r = client.post("/users/nobody@example.com/password", json={**CHANGE, "new_password": "short"})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    r = client.post("/users/ada@example.com/password", json={"old_password": "wrong one", "new_password": "wrong one"})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.post("/login", json=ADA).status_code == 200
    r = client.post("/users/ada@example.com/password", json={**CHANGE, "new_password": "12345678"})
    assert r.status_code == 200
