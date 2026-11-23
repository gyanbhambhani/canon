from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
HOME = "1 Main St"


def order(email: str, lines: list[dict[str, object]], address: str = HOME) -> dict[str, object]:
    return {"email": email, "lines": lines, "shipping_address": address}


def test_orders_with_an_address(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    client.post("/users", json=ADA)
    lines = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]
    r = client.post("/orders", json=order("ada@example.com", lines, "  1 Main St  "))
    assert r.status_code == 200
    assert r.json() == {
        "id": 1,
        "email": "ada@example.com",
        "lines": lines,
        "shipping_address": HOME,
        "total": 2209,
        "status": {"kind": "Open"},
    }
    r = client.post("/orders", json=order("ada@example.com", [{"sku": "pear", "quantity": 1}]))
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "pear"}
    assert client.post("/orders", json=order("ada@example.com", [])).status_code == 422
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    paid = client.post("/orders/1/pay").json()
    assert paid["shipping_address"] == HOME
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-2209"}
    assert client.post("/orders/9/pay").json()["error"] == {"kind": "Missing", "sku": "order 9"}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0


def test_address_rule(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    lines = [{"sku": "apple", "quantity": 1}]
    for bad in ["", "     ", "1 Ma", "  ab  "]:
        r = client.post("/orders", json=order("ada@example.com", lines, bad))
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError", bad
    r = client.post("/orders", json={"email": "ada@example.com", "lines": lines})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/orders/first").json() is None
    r = client.post("/orders", json=order("ada@example.com", lines, " 1 Ma "))
    assert r.status_code == 422
    r = client.post("/orders", json=order("ada@example.com", lines, "1 Mai"))
    assert r.status_code == 200 and r.json()["shipping_address"] == "1 Mai"


def test_reports_with_addresses(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    assert client.get("/orders/first").json() is None
    client.post("/orders", json=order("bob@example.com", [{"sku": "apple", "quantity": 1}]))
    client.post("/orders", json=order("ada@example.com", [{"sku": "apple", "quantity": 3}]))
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 1, "spent": 315},
        {"email": "bob@example.com", "orders": 1, "spent": 105},
    ]
    assert client.get("/customers").json() == [["Ada", 2]]
    assert client.get("/orders/first").json() == "bob@example.com"
