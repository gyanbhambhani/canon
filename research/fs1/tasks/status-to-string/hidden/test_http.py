from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}


def count(client: TestClient, email: str, status: str) -> object:
    return client.get("/orders/count", params={"email": email, "status": status}).json()


def test_orders_with_string_status(client: TestClient) -> None:
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
        "total": 2209,
        "status": "open",
        "receipt": None,
    }
    r = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "pear", "quantity": 1}]})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "pear"}
    assert client.post("/orders", json={"email": "ada@example.com", "lines": []}).status_code == 422
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    r = client.post("/orders/1/pay")
    assert r.status_code == 200
    assert r.json() == {
        "id": 1,
        "email": "ada@example.com",
        "lines": lines,
        "total": 2209,
        "status": "paid",
        "receipt": "test-receipt-2209",
    }
    assert client.post("/orders/9/pay").json()["error"] == {"kind": "Missing", "sku": "order 9"}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0


def test_count_by_status(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    for email in ["ada@example.com", "ada@example.com", "ada@example.com", "bob@example.com"]:
        client.post("/orders", json={"email": email, "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders/2/pay")
    assert count(client, "ada@example.com", "open") == 2
    assert count(client, "ada@example.com", "paid") == 1
    assert count(client, "ada@example.com", "cancelled") == 0
    assert count(client, "bob@example.com", "open") == 1
    assert count(client, "cy@example.com", "open") == 0
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 2


def test_count_rejects_other_statuses(client: TestClient) -> None:
    for bad in ["Open", "PAID", "", "refunded", " open"]:
        r = client.get("/orders/count", params={"email": "ada@example.com", "status": bad})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError", bad
    r = client.get("/orders/count", params={"email": "ada@example.com"})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
