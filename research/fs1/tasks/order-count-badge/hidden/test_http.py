from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
ONE = [{"sku": "apple", "quantity": 1}]


def place(client: TestClient, email: str, n: int) -> None:
    for _ in range(n):
        client.post("/orders", json={"email": email, "lines": ONE})


def badge(client: TestClient) -> object:
    r = client.get("/users/ada@example.com/badge")
    assert r.status_code == 200
    return r.json()


def test_badge_counts_open_orders(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    assert badge(client) == {"email": "ada@example.com", "open": 0, "label": "No open orders"}
    place(client, "ada@example.com", 1)
    place(client, "bob@example.com", 2)
    assert badge(client) == {"email": "ada@example.com", "open": 1, "label": "1 open order"}
    place(client, "ada@example.com", 2)
    assert badge(client) == {"email": "ada@example.com", "open": 3, "label": "3 open orders"}
    client.post("/orders/1/pay")
    assert badge(client) == {"email": "ada@example.com", "open": 2, "label": "2 open orders"}


def test_badge_caps_at_nine(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    place(client, "ada@example.com", 9)
    assert badge(client) == {"email": "ada@example.com", "open": 9, "label": "9 open orders"}
    place(client, "ada@example.com", 1)
    assert badge(client) == {"email": "ada@example.com", "open": 10, "label": "9+ open orders"}
    place(client, "ada@example.com", 2)
    assert badge(client) == {"email": "ada@example.com", "open": 12, "label": "9+ open orders"}


def test_badge_needs_a_user(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    place(client, "bob@example.com", 1)
    r = client.get("/users/bob@example.com/badge")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "NoUser", "email": "bob@example.com"}}
