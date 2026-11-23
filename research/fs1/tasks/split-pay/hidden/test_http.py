from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
LINES = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]


def open_count(client: TestClient) -> int:
    return client.get("/orders/open", params={"email": "ada@example.com"}).json()  # type: ignore[no-any-return]


def test_orders_authorize_and_capture(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    client.post("/users", json=ADA)
    order = client.post("/orders", json={"email": "ada@example.com", "lines": LINES}).json()
    assert order == {"id": 1, "email": "ada@example.com", "lines": LINES, "total": 2209, "status": {"kind": "Open"}}
    r = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "pear", "quantity": 1}]})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "pear"}
    assert client.post("/orders", json={"email": "ada@example.com", "lines": []}).status_code == 422
    assert open_count(client) == 1
    r = client.post("/orders/1/authorize")
    assert r.status_code == 200
    assert r.json() == {**order, "status": {"kind": "Authorized", "authorization": "test-receipt-2209"}}
    assert open_count(client) == 0
    r = client.post("/orders/1/capture")
    assert r.status_code == 200
    assert r.json() == {**order, "status": {"kind": "Paid", "receipt": "test-receipt-2209"}}
    assert open_count(client) == 0


def test_steps_in_order(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    r = client.post("/orders/1/capture")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not authorized"}}
    assert client.post("/orders/1/authorize").status_code == 200
    r = client.post("/orders/1/authorize")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not open"}}
    assert client.post("/orders/1/capture").json()["status"] == {"kind": "Paid", "receipt": "test-receipt-105"}
    r = client.post("/orders/1/capture")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not authorized"}}
    r = client.post("/orders/1/authorize")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not open"}}


def test_unknown_orders(client: TestClient) -> None:
    for step in ["authorize", "capture"]:
        r = client.post(f"/orders/9/{step}")
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "Missing", "sku": "order 9"}}


def test_pay_is_gone(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    assert client.post("/orders/1/pay").status_code in (404, 405)
    assert open_count(client) == 1
