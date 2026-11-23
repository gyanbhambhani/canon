"""The regression suite: the shop's behavior before any task, checked over HTTP in every arm.
A change task lists the tests it supersedes in its task.json (supersedes); its hidden tests then
check the new behavior instead."""

from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_add_and_get_product(client: TestClient) -> None:
    assert client.post("/products", json=APPLE).json() == APPLE
    assert client.get("/products/apple").json() == APPLE


def test_duplicate_product_is_invalid(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    r = client.post("/products", json=APPLE)
    assert r.status_code == 400
    assert r.json()["error"] == {"kind": "Invalid", "reason": "duplicate sku apple"}


def test_product_validation(client: TestClient) -> None:
    for bad in [{**APPLE, "sku": "ab"}, {**APPLE, "cents": -1}, {**APPLE, "stock": -2}]:
        r = client.post("/products", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"


def test_malformed_body_is_a_validation_error(client: TestClient) -> None:
    r = client.post("/products", json={"sku": "apple"})
    assert r.status_code == 422 and kind(r) == "ValidationError"


def test_missing_product(client: TestClient) -> None:
    r = client.get("/products/nope")
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "nope"}


def test_list_products_pages_and_tags(client: TestClient) -> None:
    for p in [PEAR, HAMMER, APPLE]:
        client.post("/products", json=p)
    skus = lambda r: [p["sku"] for p in r.json()]  # noqa: E731
    assert skus(client.get("/products", params={"page": 1, "per_page": 2})) == ["apple", "hammer"]
    assert skus(client.get("/products", params={"page": 2, "per_page": 2})) == ["pear"]
    assert skus(client.get("/products", params={"tag": "fruit", "page": 1, "per_page": 10})) == ["apple", "pear"]
    r = client.get("/products", params={"page": 0, "per_page": 2})
    assert r.status_code == 422 and kind(r) == "ValidationError"


def test_restock(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    assert client.patch("/products/apple/stock", json={"amount": 2}).json()["stock"] == 5
    assert client.patch("/products/apple/stock", json={"amount": 0}).status_code == 422
    assert client.patch("/products/pear/stock", json={"amount": 1}).json()["error"]["kind"] == "Missing"


def test_prices_average_and_delete(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    assert client.get("/prices").json() == {"apple": "$1.05", "hammer": "$19.99"}
    assert client.get("/average", params={"skus": "apple,hammer"}).json() == 1052
    r = client.get("/average", params={"skus": "nothing"})
    assert r.status_code == 500 and r.json() == {"error": {"kind": "InternalError"}}
    assert client.delete("/products/apple").json() is True
    assert client.delete("/products/apple").json() is False


def test_signup_and_login(client: TestClient) -> None:
    assert client.post("/users", json={**ADA, "name": " Ada "}).json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/login", json={**ADA, "password": "wrong password"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}


def test_signup_validation(client: TestClient) -> None:
    for bad in [{**ADA, "email": "ada"}, {**ADA, "name": "   "}, {**ADA, "password": "short"}]:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"


def test_orders(client: TestClient) -> None:
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


def test_reports(client: TestClient) -> None:
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
