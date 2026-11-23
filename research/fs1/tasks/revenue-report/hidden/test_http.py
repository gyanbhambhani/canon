from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}


def place(client: TestClient, email: str, sku: str, quantity: int) -> int:
    lines = [{"sku": sku, "quantity": quantity}]
    return client.post("/orders", json={"email": email, "lines": lines}).json()["id"]  # type: ignore[no-any-return]


def test_revenue_counts_paid_orders_only(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    a1 = place(client, "ada@example.com", "apple", 2)  # 210
    a2 = place(client, "ada@example.com", "hammer", 1)  # 1999
    place(client, "ada@example.com", "hammer", 3)  # open: not counted
    b1 = place(client, "bob@example.com", "apple", 1)  # 105
    place(client, "cy@example.com", "apple", 9)  # open only: no row
    for order_id in [a1, a2, b1]:
        client.post(f"/orders/{order_id}/pay")
    r = client.get("/reports/revenue")
    assert r.status_code == 200
    assert r.json() == [
        {"email": "ada@example.com", "orders": 2, "revenue": 2209},
        {"email": "bob@example.com", "orders": 1, "revenue": 105},
    ]


def test_ties_are_sorted_by_email(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    for email in ["cy@example.com", "ada@example.com", "bob@example.com"]:
        place(client, email, "apple", 1)
    place(client, "dee@example.com", "apple", 2)
    for order_id in [1, 2, 3, 4]:
        client.post(f"/orders/{order_id}/pay")
    assert client.get("/reports/revenue").json() == [
        {"email": "dee@example.com", "orders": 1, "revenue": 210},
        {"email": "ada@example.com", "orders": 1, "revenue": 105},
        {"email": "bob@example.com", "orders": 1, "revenue": 105},
        {"email": "cy@example.com", "orders": 1, "revenue": 105},
    ]


def test_no_paid_orders(client: TestClient) -> None:
    assert client.get("/reports/revenue").json() == []
    client.post("/products", json=APPLE)
    place(client, "ada@example.com", "apple", 1)
    r = client.get("/reports/revenue")
    assert r.status_code == 200 and r.json() == []
    # the existing report still counts every order
    assert client.get("/summaries").json() == [{"email": "ada@example.com", "orders": 1, "spent": 105}]
