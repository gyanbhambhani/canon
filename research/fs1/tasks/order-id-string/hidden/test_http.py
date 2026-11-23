from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}


def test_orders_with_string_ids(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    lines = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]
    order = client.post("/orders", json={"email": "ada@example.com", "lines": lines}).json()
    assert order == {"id": "order-1", "email": "ada@example.com", "lines": lines, "total": 2209, "status": {"kind": "Open"}}
    second = client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]}).json()
    assert second["id"] == "order-2"
    r = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "pear", "quantity": 1}]})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "pear"}
    assert client.post("/orders", json={"email": "ada@example.com", "lines": []}).status_code == 422
    paid = client.post("/orders/order-1/pay").json()
    assert paid["id"] == "order-1" and paid["status"] == {"kind": "Paid", "receipt": "test-receipt-2209"}
    r = client.post("/orders/order-9/pay")
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "order-9"}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0


def test_listing_order_is_kept_after_paying(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    for email in ["bob@example.com", "ada@example.com", "cy@example.com"]:
        client.post("/orders", json={"email": email, "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders/order-1/pay")
    assert client.get("/orders/first").json() == "bob@example.com"
    assert [s["email"] for s in client.get("/summaries").json()] == ["bob@example.com", "ada@example.com", "cy@example.com"]
    # ids keep counting: the next order is order-4
    assert client.post("/orders", json={"email": "d@example.com", "lines": [{"sku": "apple", "quantity": 1}]}).json()["id"] == "order-4"
