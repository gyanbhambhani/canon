from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
LINES = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]


def setup(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    client.post("/orders", json={"email": "ada@example.com", "lines": LINES})
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})


def test_reorder(client: TestClient) -> None:
    setup(client)
    r = client.post("/orders/1/reorder")
    assert r.status_code == 200
    assert r.json() == {"id": 3, "email": "ada@example.com", "lines": LINES, "total": 2209, "status": {"kind": "Open"}}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 2
    assert client.post("/orders/3/pay").json()["status"] == {"kind": "Paid", "receipt": "test-receipt-2209"}


def test_reorder_a_paid_order_at_current_prices(client: TestClient) -> None:
    setup(client)
    client.post("/orders/1/pay")
    client.delete("/products/hammer")
    client.post("/products", json={**HAMMER, "cents": 2500})
    r = client.post("/orders/1/reorder")
    assert r.status_code == 200
    assert r.json() == {"id": 3, "email": "ada@example.com", "lines": LINES, "total": 2710, "status": {"kind": "Open"}}
    # the old order is unchanged: it is still paid, with its own total
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    assert client.get("/summaries").json()[0] == {"email": "ada@example.com", "orders": 2, "spent": 2209 + 2710}


def test_reorder_errors(client: TestClient) -> None:
    setup(client)
    r = client.post("/orders/9/reorder")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "order 9"}}
    client.delete("/products/hammer")
    r = client.post("/orders/1/reorder")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "hammer"}}
    # no order was created: the next one is order 3
    assert client.post("/orders/2/reorder").json()["id"] == 3
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 1, "spent": 2209},
        {"email": "bob@example.com", "orders": 2, "spent": 210},
    ]
