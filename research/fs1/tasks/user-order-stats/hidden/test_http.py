from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool"]}


def order(client: TestClient, email: str, sku: str, quantity: int) -> int:
    r = client.post("/orders", json={"email": email, "lines": [{"sku": sku, "quantity": quantity}]})
    return int(r.json()["id"])


def test_stats_count_orders_and_paid_totals(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    client.post("/users", json=ADA)
    first = order(client, "ada@example.com", "apple", 2)  # 210, paid
    order(client, "bob@example.com", "hammer", 1)  # someone else's
    second = order(client, "ada@example.com", "hammer", 1)  # 1999, paid
    order(client, "ada@example.com", "apple", 1)  # 105, open
    assert client.get("/users/ada@example.com/stats").json() == {"email": "ada@example.com", "orders": 3, "spent": 0}
    client.post(f"/orders/{first}/pay")
    client.post(f"/orders/{second}/pay")
    r = client.get("/users/ada@example.com/stats")
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "orders": 3, "spent": 2209}


def test_stats_without_orders(client: TestClient) -> None:
    client.post("/users", json=ADA)
    assert client.get("/users/ada@example.com/stats").json() == {"email": "ada@example.com", "orders": 0, "spent": 0}


def test_stats_unknown_user(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    order(client, "bob@example.com", "apple", 1)
    for email in ["bob@example.com", "nobody@example.com"]:
        r = client.get(f"/users/{email}/stats")
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "NoSuchUser", "email": email}}
