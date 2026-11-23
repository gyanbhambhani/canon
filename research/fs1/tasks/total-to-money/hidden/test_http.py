from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}


def test_orders_with_money_totals(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    client.post("/users", json=ADA)
    lines = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]
    r = client.post("/orders", json={"email": "ada@example.com", "lines": lines})
    assert r.status_code == 200
    assert r.json() == {
        "id": 1,
        "email": "ada@example.com",
        "lines": lines,
        "total": {"cents": 2209, "currency": "USD"},
        "status": {"kind": "Open"},
    }
    r = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "pear", "quantity": 1}]})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "pear"}
    assert client.post("/orders", json={"email": "ada@example.com", "lines": []}).status_code == 422
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    paid = client.post("/orders/1/pay").json()
    assert paid["total"] == {"cents": 2209, "currency": "USD"}
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-2209"}
    assert client.post("/orders/9/pay").json()["error"] == {"kind": "Missing", "sku": "order 9"}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0


def test_summaries_keep_integer_cents(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders/2/pay")
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 2, "spent": 420},
        {"email": "bob@example.com", "orders": 1, "spent": 105},
    ]
