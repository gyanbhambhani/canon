from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
DEACTIVATED = {"error": {"kind": "Deactivated", "email": "ada@example.com"}}


def test_deactivate_returns_profile(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.post("/users/ada@example.com/deactivate")
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/users/ada@example.com/deactivate")
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada"}


def test_deactivated_user_cannot_log_in(client: TestClient) -> None:
    client.post("/users", json=ADA)
    assert client.post("/login", json=ADA).status_code == 200
    client.post("/users/ada@example.com/deactivate")
    r = client.post("/login", json=ADA)
    assert r.status_code == 400 and r.json() == DEACTIVATED
    r = client.post("/login", json={**ADA, "password": "wrong password"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadLogin"}}
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"]["kind"] == "Taken"


def test_deactivated_user_cannot_order(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/users", json={**ADA, "email": "bob@example.com", "name": "Bob"})
    client.post("/users/ada@example.com/deactivate")
    lines = [{"sku": "apple", "quantity": 1}]
    r = client.post("/orders", json={"email": "ada@example.com", "lines": lines})
    assert r.status_code == 400 and r.json() == DEACTIVATED
    r = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "pear", "quantity": 1}]})
    assert r.status_code == 400 and r.json() == DEACTIVATED
    r = client.post("/orders", json={"email": "ada@example.com", "lines": []})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/orders/first").json() is None
    # an active account and an email without an account still order
    assert client.post("/orders", json={"email": "bob@example.com", "lines": lines}).json()["id"] == 1
    assert client.post("/orders", json={"email": "cy@example.com", "lines": lines}).json()["id"] == 2
    assert client.post("/login", json={**ADA, "email": "bob@example.com"}).status_code == 200


def test_deactivate_unknown_user(client: TestClient) -> None:
    r = client.post("/users/nobody@example.com/deactivate")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}
