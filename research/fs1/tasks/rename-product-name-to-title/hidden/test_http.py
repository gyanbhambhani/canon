"""The regression suite, with the product field name renamed to title. A user's name is unchanged."""

from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "title": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "title": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "title": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_add_and_get_product_titled(client: TestClient) -> None:
    assert client.post("/products", json=APPLE).json() == APPLE
    assert client.get("/products/apple").json() == APPLE


def test_a_product_without_a_title_is_invalid(client: TestClient) -> None:
    old = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
    r = client.post("/products", json=old)
    assert r.status_code == 422 and kind(r) == "ValidationError"
    assert client.get("/products/apple").status_code == 400


def test_duplicate_product_is_invalid_titled(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    r = client.post("/products", json=APPLE)
    assert r.status_code == 400
    assert r.json()["error"] == {"kind": "Invalid", "reason": "duplicate sku apple"}


def test_product_validation_titled(client: TestClient) -> None:
    for bad in [{**APPLE, "sku": "ab"}, {**APPLE, "cents": -1}, {**APPLE, "stock": -2}]:
        r = client.post("/products", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"


def test_list_products_pages_and_tags_titled(client: TestClient) -> None:
    for p in [PEAR, HAMMER, APPLE]:
        client.post("/products", json=p)
    r = client.get("/products", params={"page": 1, "per_page": 2})
    assert r.json() == [APPLE, HAMMER]
    skus = lambda r: [p["sku"] for p in r.json()]  # noqa: E731
    assert skus(client.get("/products", params={"page": 2, "per_page": 2})) == ["pear"]
    assert skus(client.get("/products", params={"tag": "fruit", "page": 1, "per_page": 10})) == ["apple", "pear"]
    r = client.get("/products", params={"page": 0, "per_page": 2})
    assert r.status_code == 422 and kind(r) == "ValidationError"


def test_restock_titled(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    assert client.patch("/products/apple/stock", json={"amount": 2}).json() == {**APPLE, "stock": 5}
    assert client.patch("/products/apple/stock", json={"amount": 0}).status_code == 422
    assert client.patch("/products/pear/stock", json={"amount": 1}).json()["error"]["kind"] == "Missing"


def test_prices_average_and_delete_titled(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    assert client.get("/prices").json() == {"apple": "$1.05", "hammer": "$19.99"}
    assert client.get("/average", params={"skus": "apple,hammer"}).json() == 1052
    r = client.get("/average", params={"skus": "nothing"})
    assert r.status_code == 500 and r.json() == {"error": {"kind": "InternalError"}}
    assert client.delete("/products/apple").json() is True
    assert client.delete("/products/apple").json() is False


def test_orders_titled(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    client.post("/users", json=ADA)
    lines = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]
    order = client.post("/orders", json={"email": "ada@example.com", "lines": lines}).json()
    assert order == {"id": 1, "email": "ada@example.com", "lines": lines, "total": 2209, "status": {"kind": "Open"}}
    r = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "pear", "quantity": 1}]})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "pear"}
    assert client.post("/orders", json={"email": "ada@example.com", "lines": []}).status_code == 422
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    paid = client.post("/orders/1/pay").json()
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-2209"}
    assert client.post("/orders/9/pay").json()["error"] == {"kind": "Missing", "sku": "order 9"}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0


def test_reports_titled(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    assert client.get("/orders/first").json() is None
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 1, "spent": 315},
        {"email": "bob@example.com", "orders": 1, "spent": 105},
    ]
    assert client.get("/customers").json() == [["Ada", 2]]
    assert client.get("/orders/first").json() == "bob@example.com"


def test_users_keep_their_name(client: TestClient) -> None:
    assert client.post("/users", json={**ADA, "name": " Ada "}).json() == {"email": "ada@example.com", "name": "Ada"}
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada"}
