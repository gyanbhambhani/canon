from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}


def test_get_an_order(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    lines = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]
    placed = client.post("/orders", json={"email": "ada@example.com", "lines": lines}).json()
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    r = client.get("/orders/1")
    assert r.status_code == 200 and r.json() == placed
    assert client.get("/orders/2").json()["email"] == "bob@example.com"


def test_get_a_paid_order(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    paid = client.post("/orders/1/pay").json()
    assert client.get("/orders/1").json() == paid
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-105"}


def test_get_an_unknown_order(client: TestClient) -> None:
    r = client.get("/orders/42")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Missing", "sku": "order 42"}}
    r = client.get("/orders/forty-two")
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"


def test_open_and_first_still_work(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    assert client.get("/orders/first").json() is None
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    r = client.get("/orders/open", params={"email": "ada@example.com"})
    assert r.status_code == 200 and r.json() == 1
    r = client.get("/orders/first")
    assert r.status_code == 200 and r.json() == "ada@example.com"
