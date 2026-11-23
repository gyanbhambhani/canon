from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}


def place(client: TestClient, email: str, sku: str, quantity: int) -> dict[str, object]:
    lines = [{"sku": sku, "quantity": quantity}]
    return client.post("/orders", json={"email": email, "lines": lines}).json()  # type: ignore[no-any-return]


def test_orders_by_status(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    first = place(client, "ada@example.com", "apple", 2)
    second = place(client, "bob@example.com", "hammer", 1)
    third = place(client, "ada@example.com", "apple", 1)
    paid = client.post("/orders/2/pay").json()
    r = client.get("/orders/by-status", params={"status": "Open"})
    assert r.status_code == 200 and r.json() == [first, third]
    r = client.get("/orders/by-status", params={"status": "Paid"})
    assert r.status_code == 200 and r.json() == [paid]
    assert paid == {**second, "status": {"kind": "Paid", "receipt": "test-receipt-1999"}}
    r = client.get("/orders/by-status", params={"status": "Cancelled"})
    assert r.status_code == 200 and r.json() == []


def test_paid_orders_oldest_first(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    for email in ["cy@example.com", "ada@example.com", "bob@example.com"]:
        place(client, email, "apple", 1)
    client.post("/orders/3/pay")
    client.post("/orders/1/pay")
    r = client.get("/orders/by-status", params={"status": "Paid"})
    assert [o["id"] for o in r.json()] == [1, 3]
    assert client.get("/orders/by-status", params={"status": "Open"}).json()[0]["email"] == "ada@example.com"


def test_no_orders(client: TestClient) -> None:
    for status in ["Open", "Paid", "Cancelled"]:
        r = client.get("/orders/by-status", params={"status": status})
        assert r.status_code == 200 and r.json() == []


def test_status_validation(client: TestClient) -> None:
    for bad in ["open", "PAID", "Refunded", "", "Open "]:
        r = client.get("/orders/by-status", params={"status": bad})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError", bad
    r = client.get("/orders/by-status")
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
