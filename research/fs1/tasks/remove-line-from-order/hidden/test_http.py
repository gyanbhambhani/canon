from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
LINES = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}, {"sku": "pear", "quantity": 3}]


def setup(client: TestClient) -> dict[str, object]:
    for p in [APPLE, HAMMER, PEAR]:
        client.post("/products", json=p)
    return client.post("/orders", json={"email": "ada@example.com", "lines": LINES}).json()  # type: ignore[no-any-return]


def test_remove_a_line(client: TestClient) -> None:
    order = setup(client)
    assert order["total"] == 2449
    r = client.delete("/orders/1/lines/hammer")
    assert r.status_code == 200
    assert r.json() == {
        **order,
        "lines": [{"sku": "apple", "quantity": 2}, {"sku": "pear", "quantity": 3}],
        "total": 450,
    }


def test_the_change_is_saved(client: TestClient) -> None:
    setup(client)
    client.delete("/orders/1/lines/apple")
    r = client.delete("/orders/1/lines/pear")
    assert r.json()["lines"] == [{"sku": "hammer", "quantity": 1}]
    paid = client.post("/orders/1/pay").json()
    assert paid["total"] == 1999
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-1999"}
    assert paid["lines"] == [{"sku": "hammer", "quantity": 1}]


def test_errors(client: TestClient) -> None:
    setup(client)
    r = client.delete("/orders/9/lines/apple")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "order 9"}}
    r = client.delete("/orders/1/lines/plum")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "plum"}}
    client.delete("/orders/1/lines/apple")
    client.delete("/orders/1/lines/pear")
    r = client.delete("/orders/1/lines/hammer")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Invalid", "reason": "order 1 would be empty"}}
    assert client.post("/orders/1/pay").json()["lines"] == [{"sku": "hammer", "quantity": 1}]


def test_only_open_orders_change(client: TestClient) -> None:
    setup(client)
    client.post("/orders/1/pay")
    r = client.delete("/orders/1/lines/apple")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not open"}}
