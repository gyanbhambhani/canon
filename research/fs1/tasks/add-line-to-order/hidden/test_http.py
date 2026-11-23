from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}


def setup(client: TestClient) -> dict[str, object]:
    for p in [APPLE, HAMMER, PEAR]:
        client.post("/products", json=p)
    lines = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]
    return client.post("/orders", json={"email": "ada@example.com", "lines": lines}).json()  # type: ignore[no-any-return]


def test_add_a_new_line(client: TestClient) -> None:
    order = setup(client)
    r = client.post("/orders/1/lines", json={"sku": "pear", "quantity": 3})
    assert r.status_code == 200
    assert r.json() == {
        **order,
        "lines": [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}, {"sku": "pear", "quantity": 3}],
        "total": 2209 + 240,
    }


def test_add_more_of_a_product(client: TestClient) -> None:
    setup(client)
    r = client.post("/orders/1/lines", json={"sku": "apple", "quantity": 1})
    assert r.status_code == 200
    body = r.json()
    assert body["lines"] == [{"sku": "apple", "quantity": 3}, {"sku": "hammer", "quantity": 1}]
    assert body["total"] == 2209 + 105
    assert body["status"] == {"kind": "Open"}


def test_the_change_is_saved(client: TestClient) -> None:
    setup(client)
    client.post("/orders/1/lines", json={"sku": "pear", "quantity": 1})
    paid = client.post("/orders/1/pay").json()
    assert paid["total"] == 2289
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-2289"}
    assert len(paid["lines"]) == 3


def test_quantity_rule(client: TestClient) -> None:
    setup(client)
    for q in [0, -2]:
        r = client.post("/orders/1/lines", json={"sku": "pear", "quantity": q})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # validation comes first, even for an unknown order
    r = client.post("/orders/77/lines", json={"sku": "pear", "quantity": 0})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    r = client.post("/orders/1/lines", json={"sku": "pear"})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"


def test_errors(client: TestClient) -> None:
    setup(client)
    r = client.post("/orders/77/lines", json={"sku": "pear", "quantity": 1})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "order 77"}}
    r = client.post("/orders/1/lines", json={"sku": "plum", "quantity": 1})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "plum"}}
    client.post("/orders/1/pay")
    r = client.post("/orders/1/lines", json={"sku": "pear", "quantity": 1})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not open"}}
    # not open comes before an unknown product
    r = client.post("/orders/1/lines", json={"sku": "plum", "quantity": 1})
    assert r.status_code == 400 and r.json()["error"]["kind"] == "Invalid"
