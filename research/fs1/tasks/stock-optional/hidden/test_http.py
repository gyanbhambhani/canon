from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
FIG = {"sku": "fig", "name": "Fig", "cents": 250, "stock": None, "tags": ["fruit"]}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_unknown_stock_is_saved_as_null(client: TestClient) -> None:
    r = client.post("/products", json=FIG)
    assert r.status_code == 200 and r.json() == FIG
    assert client.get("/products/fig").json() == FIG
    client.post("/products", json=APPLE)
    listed = client.get("/products", params={"tag": "fruit", "page": 1, "per_page": 10}).json()
    assert listed == [APPLE, FIG]


def test_restock_an_unknown_stock(client: TestClient) -> None:
    client.post("/products", json=FIG)
    r = client.patch("/products/fig/stock", json={"amount": 5})
    assert r.status_code == 200 and r.json() == {**FIG, "stock": 5}
    assert client.patch("/products/fig/stock", json={"amount": 2}).json()["stock"] == 7
    assert client.get("/products/fig").json()["stock"] == 7


def test_negative_stock_is_invalid(client: TestClient) -> None:
    for stock in [-1, -20]:
        r = client.post("/products", json={**APPLE, "stock": stock})
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "Invalid", "reason": "stock is negative"}}
    assert client.get("/products/apple").status_code == 400
    assert client.post("/products", json={**APPLE, "stock": 0}).json() == {**APPLE, "stock": 0}


def test_product_validation_with_optional_stock(client: TestClient) -> None:
    for bad in [{**APPLE, "sku": "ab"}, {**APPLE, "cents": -1}, {**FIG, "sku": "ab"}, {**APPLE, "stock": "many"}]:
        r = client.post("/products", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"


def test_orders_with_unknown_stock(client: TestClient) -> None:
    client.post("/products", json=FIG)
    order = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "fig", "quantity": 2}]}).json()
    assert order["total"] == 500 and order["status"] == {"kind": "Open"}
    assert client.get("/prices").json() == {"fig": "$2.50"}
