from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 100, "stock": 3, "tags": []}


def orders_for(client: TestClient, email: str, n: int) -> None:
    for q in range(1, n + 1):
        client.post("/orders", json={"email": email, "lines": [{"sku": "apple", "quantity": q}]})


def test_pages_of_one_customers_orders(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    orders_for(client, "ada@example.com", 3)
    orders_for(client, "bob@example.com", 2)
    orders_for(client, "ada@example.com", 2)
    page = lambda p, n: client.get("/orders", params={"email": "ada@example.com", "page": p, "per_page": n})  # noqa: E731
    assert [o["id"] for o in page(1, 2).json()] == [1, 2]
    assert [o["id"] for o in page(2, 2).json()] == [3, 6]
    assert [o["id"] for o in page(3, 2).json()] == [7]
    assert page(4, 2).json() == []
    first = page(1, 1).json()[0]
    assert first == {"id": 1, "email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 1}], "total": 100, "status": {"kind": "Open"}}


def test_unknown_customer_has_no_orders(client: TestClient) -> None:
    assert client.get("/orders", params={"email": "nobody@example.com", "page": 1, "per_page": 5}).json() == []


def test_validation(client: TestClient) -> None:
    for page, per_page in [(0, 5), (-1, 5), (1, 0), (1, 21)]:
        r = client.get("/orders", params={"email": "ada@example.com", "page": page, "per_page": per_page})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/orders", params={"email": "ada@example.com", "page": 1, "per_page": 20}).status_code == 200
