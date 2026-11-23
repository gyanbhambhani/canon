from fastapi.testclient import TestClient
from httpx import Response

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}


def place(client: TestClient, lines: list[dict[str, object]]) -> Response:
    return client.post("/orders", json={"email": "ada@example.com", "lines": lines})


def test_quantities_outside_the_range(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    for q in [0, -1, -50, 100, 1000]:
        r = place(client, [{"sku": "apple", "quantity": q}])
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "BadQuantity", "sku": "apple", "quantity": q}}
    assert client.get("/orders/first").json() is None
    assert client.get("/summaries").json() == []


def test_the_first_bad_line_is_reported(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    lines = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 0}, {"sku": "apple", "quantity": 120}]
    r = place(client, lines)
    assert r.status_code == 400
    assert r.json()["error"] == {"kind": "BadQuantity", "sku": "hammer", "quantity": 0}


def test_quantity_is_checked_before_products(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    r = place(client, [{"sku": "pear", "quantity": 1}, {"sku": "apple", "quantity": 0}])
    assert r.status_code == 400
    assert r.json()["error"] == {"kind": "BadQuantity", "sku": "apple", "quantity": 0}
    r = place(client, [{"sku": "pear", "quantity": 1}])
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "pear"}
    assert place(client, []).status_code == 422


def test_the_bounds_are_allowed(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    lines = [{"sku": "apple", "quantity": 1}, {"sku": "hammer", "quantity": 99}]
    r = place(client, lines)
    assert r.status_code == 200
    assert r.json() == {
        "id": 1,
        "email": "ada@example.com",
        "lines": lines,
        "total": 105 + 1999 * 99,
        "status": {"kind": "Open"},
    }
    paid = client.post("/orders/1/pay").json()
    assert paid["status"] == {"kind": "Paid", "receipt": f"test-receipt-{105 + 1999 * 99}"}
