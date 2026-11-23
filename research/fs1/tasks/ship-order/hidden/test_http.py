from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
LINES = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]


def place(client: TestClient) -> dict[str, object]:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    r = client.post("/orders", json={"email": "ada@example.com", "lines": LINES})
    return r.json()  # type: ignore[no-any-return]


def test_ship_a_paid_order(client: TestClient) -> None:
    order = place(client)
    client.post("/orders/1/pay")
    r = client.post("/orders/1/ship", json={"tracking": "  1Z999AA1  "})
    assert r.status_code == 200
    assert r.json() == {**order, "status": {"kind": "Shipped", "tracking": "1Z999AA1"}}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0
    # a later request sees it shipped: shipping again is refused
    again = client.post("/orders/1/ship", json={"tracking": "1Z999AA2"})
    assert again.status_code == 400
    assert again.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not paid"}}


def test_ship_an_open_order(client: TestClient) -> None:
    place(client)
    r = client.post("/orders/1/ship", json={"tracking": "1Z999AA1"})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not paid"}}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1


def test_ship_an_unknown_order(client: TestClient) -> None:
    r = client.post("/orders/8/ship", json={"tracking": "1Z999AA1"})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Missing", "sku": "order 8"}}


def test_tracking_validation(client: TestClient) -> None:
    place(client)
    client.post("/orders/1/pay")
    for bad in ["", "   ", "\t"]:
        r = client.post("/orders/1/ship", json={"tracking": bad})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # checked before the order is looked up
    r = client.post("/orders/8/ship", json={"tracking": " "})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    r = client.post("/orders/1/ship", json={})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # the order is still paid and can be shipped
    assert client.post("/orders/1/ship", json={"tracking": "x"}).json()["status"] == {"kind": "Shipped", "tracking": "x"}
