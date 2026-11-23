from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
BOB = {"email": "bob@example.com", "name": "Bob", "password": "battery staple"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def test_delete_account(client: TestClient) -> None:
    client.post("/users", json=ADA)
    client.post("/users", json=BOB)
    r = client.post("/users/ada@example.com/delete", json={"password": "correct horse"})
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/login", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}
    assert client.get("/customers").json() == [["Bob", 0]]
    r = client.post("/users", json={**ADA, "name": "Ada Again"})
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada Again"}


def test_delete_wrong_password_keeps_account(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.post("/users/ada@example.com/delete", json={"password": "wrong password"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "BadLogin"}}
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada"}


def test_delete_unknown_user(client: TestClient) -> None:
    r = client.post("/users/nobody@example.com/delete", json={"password": "correct horse"})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}


def test_delete_keeps_orders(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 2}]})
    client.post("/users/ada@example.com/delete", json={"password": "correct horse"})
    assert client.get("/summaries").json() == [{"email": "ada@example.com", "orders": 1, "spent": 210}]
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    assert client.get("/customers").json() == []
