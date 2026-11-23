from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}


def test_change_name(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.patch("/users/ada@example.com", json={"name": "  Ada Lovelace "})
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "name": "Ada Lovelace"}
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada Lovelace"}
    assert client.get("/customers").json() == [["Ada Lovelace", 0]]


def test_name_rules(client: TestClient) -> None:
    client.post("/users", json=ADA)
    for bad in ["", "   ", "x" * 41]:
        r = client.patch("/users/ada@example.com", json={"name": bad})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.patch("/users/ada@example.com", json={"name": "y" * 40}).status_code == 200


def test_unknown_user(client: TestClient) -> None:
    r = client.patch("/users/bob@example.com", json={"name": "Bob"})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "bob@example.com"}}
