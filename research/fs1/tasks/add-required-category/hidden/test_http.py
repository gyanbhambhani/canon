"""The regression suite with a required product category, and the category's rule."""

from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"], "category": "food"}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"], "category": "tools"}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"], "category": "food"}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_add_and_get_product_with_category(client: TestClient) -> None:
    assert client.post("/products", json=APPLE).json() == APPLE
    assert client.get("/products/apple").json() == APPLE


def test_category_is_stored_as_sent(client: TestClient) -> None:
    garden = {**APPLE, "sku": "rake", "category": " Garden & yard "}
    assert client.post("/products", json=garden).json() == garden
    assert client.get("/products/rake").json() == garden


def test_category_is_required(client: TestClient) -> None:
    no_category = {k: v for k, v in APPLE.items() if k != "category"}
    r = client.post("/products", json=no_category)
    assert r.status_code == 422 and kind(r) == "ValidationError"
    assert client.get("/products/apple").status_code == 400


def test_category_rule(client: TestClient) -> None:
    for blank in ["", " ", "   "]:
        r = client.post("/products", json={**APPLE, "category": blank})
        assert r.status_code == 422 and kind(r) == "ValidationError"
    assert client.post("/products", json={**APPLE, "category": "x"}).status_code == 200


def test_duplicate_product_is_invalid_with_category(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    r = client.post("/products", json=APPLE)
    assert r.status_code == 400
    assert r.json()["error"] == {"kind": "Invalid", "reason": "duplicate sku apple"}


def test_product_validation_with_category(client: TestClient) -> None:
    for bad in [{**APPLE, "sku": "ab"}, {**APPLE, "cents": -1}, {**APPLE, "stock": -2}]:
        r = client.post("/products", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"


def test_list_products_pages_and_tags_with_category(client: TestClient) -> None:
    for p in [PEAR, HAMMER, APPLE]:
        client.post("/products", json=p)
    assert client.get("/products", params={"page": 1, "per_page": 2}).json() == [APPLE, HAMMER]
    skus = lambda r: [p["sku"] for p in r.json()]  # noqa: E731
    assert skus(client.get("/products", params={"page": 2, "per_page": 2})) == ["pear"]
    assert skus(client.get("/products", params={"tag": "fruit", "page": 1, "per_page": 10})) == ["apple", "pear"]
    r = client.get("/products", params={"page": 0, "per_page": 2})
    assert r.status_code == 422 and kind(r) == "ValidationError"


def test_restock_with_category(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    assert client.patch("/products/apple/stock", json={"amount": 2}).json() == {**APPLE, "stock": 5}
    assert client.patch("/products/apple/stock", json={"amount": 0}).status_code == 422
    assert client.patch("/products/pear/stock", json={"amount": 1}).json()["error"]["kind"] == "Missing"


def test_prices_average_and_delete_with_category(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    assert client.get("/prices").json() == {"apple": "$1.05", "hammer": "$19.99"}
    assert client.get("/average", params={"skus": "apple,hammer"}).json() == 1052
    r = client.get("/average", params={"skus": "nothing"})
    assert r.status_code == 500 and r.json() == {"error": {"kind": "InternalError"}}
    assert client.delete("/products/apple").json() is True
    assert client.delete("/products/apple").json() is False


def test_orders_with_category(client: TestClient) -> None:
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


def test_reports_with_category(client: TestClient) -> None:
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
