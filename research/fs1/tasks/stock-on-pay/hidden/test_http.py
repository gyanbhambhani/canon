from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}


def stock(client: TestClient, sku: str) -> int:
    return client.get(f"/products/{sku}").json()["stock"]  # type: ignore[no-any-return]


def order(client: TestClient, lines: list[dict[str, object]]) -> dict[str, object]:
    r = client.post("/orders", json={"email": "ada@example.com", "lines": lines})
    return r.json()  # type: ignore[no-any-return]


def test_paying_takes_stock(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    placed = order(client, [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}])
    r = client.post("/orders/1/pay")
    assert r.status_code == 200
    assert r.json() == {**placed, "status": {"kind": "Paid", "receipt": "test-receipt-2209"}}
    assert stock(client, "apple") == 1
    assert stock(client, "hammer") == 0


def test_out_of_stock(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    order(client, [{"sku": "apple", "quantity": 1}, {"sku": "hammer", "quantity": 2}, {"sku": "apple", "quantity": 9}])
    r = client.post("/orders/1/pay")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "OutOfStock", "sku": "hammer", "available": 1}}
    assert stock(client, "apple") == 3 and stock(client, "hammer") == 1
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1


def test_stock_runs_out_across_orders(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    order(client, [{"sku": "apple", "quantity": 2}])
    order(client, [{"sku": "apple", "quantity": 2}])
    assert client.post("/orders/1/pay").status_code == 200
    r = client.post("/orders/2/pay")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "OutOfStock", "sku": "apple", "available": 1}}
    client.patch("/products/apple/stock", json={"amount": 1})
    paid = client.post("/orders/2/pay")
    assert paid.status_code == 200 and paid.json()["status"] == {"kind": "Paid", "receipt": "test-receipt-210"}
    assert stock(client, "apple") == 0
    # exactly the stock is enough
    client.patch("/products/apple/stock", json={"amount": 3})
    order(client, [{"sku": "apple", "quantity": 3}])
    assert client.post("/orders/3/pay").status_code == 200
    assert stock(client, "apple") == 0


def test_paid_order_is_not_paid_again(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    order(client, [{"sku": "apple", "quantity": 1}])
    client.post("/orders/1/pay")
    r = client.post("/orders/1/pay")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is paid"}}
    assert stock(client, "apple") == 2


def test_deleted_product_and_unknown_order(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    order(client, [{"sku": "apple", "quantity": 1}, {"sku": "hammer", "quantity": 1}])
    client.delete("/products/hammer")
    r = client.post("/orders/1/pay")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "hammer"}}
    assert stock(client, "apple") == 3
    r = client.post("/orders/9/pay")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "order 9"}}
