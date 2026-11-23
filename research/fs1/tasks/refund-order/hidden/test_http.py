from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
LINES = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]


def place(client: TestClient) -> dict[str, object]:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    r = client.post("/orders", json={"email": "ada@example.com", "lines": LINES})
    return r.json()  # type: ignore[no-any-return]


def test_refund_a_paid_order(client: TestClient) -> None:
    order = place(client)
    client.post("/orders/1/pay")
    r = client.post("/orders/1/refund")
    assert r.status_code == 200
    refunded = {**order, "status": {"kind": "Refunded", "refund": "test-receipt-2209"}}
    assert r.json() == refunded
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0
    # a later request sees the refund: refunding again is refused
    again = client.post("/orders/1/refund")
    assert again.status_code == 400
    assert again.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not paid"}}


def test_refund_an_open_order(client: TestClient) -> None:
    place(client)
    r = client.post("/orders/1/refund")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not paid"}}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    # still payable afterwards
    paid = client.post("/orders/1/pay").json()
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-2209"}


def test_refund_an_unknown_order(client: TestClient) -> None:
    r = client.post("/orders/5/refund")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Missing", "sku": "order 5"}}


def test_refund_only_that_order(client: TestClient) -> None:
    place(client)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders/1/pay")
    client.post("/orders/2/pay")
    assert client.post("/orders/2/refund").json()["status"] == {"kind": "Refunded", "refund": "test-receipt-105"}
    r = client.post("/orders/1/refund")
    assert r.status_code == 200 and r.json()["status"] == {"kind": "Refunded", "refund": "test-receipt-2209"}
