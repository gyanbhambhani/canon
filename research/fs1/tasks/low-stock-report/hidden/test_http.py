from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
FIG = {"sku": "fig", "name": "Fig", "cents": 90, "stock": 3, "tags": []}
NAIL = {"sku": "nail", "name": "Nail", "cents": 2, "stock": 0, "tags": ["tool"]}


def report(client: TestClient, below: int) -> list[dict[str, object]]:
    r = client.get("/low-stock", params={"below": below})
    assert r.status_code == 200
    return r.json()  # type: ignore[no-any-return]


def test_low_stock_rows_sorted_by_stock_then_sku(client: TestClient) -> None:
    for p in [PEAR, APPLE, HAMMER, FIG, NAIL]:
        client.post("/products", json=p)
    assert report(client, 4) == [
        {"sku": "nail", "name": "Nail", "stock": 0},
        {"sku": "hammer", "name": "Hammer", "stock": 1},
        {"sku": "apple", "name": "Apple", "stock": 3},
        {"sku": "fig", "name": "Fig", "stock": 3},
    ]
    assert [row["sku"] for row in report(client, 3)] == ["nail", "hammer"]
    assert [row["sku"] for row in report(client, 1)] == ["nail"]
    assert [row["sku"] for row in report(client, 6)] == ["nail", "hammer", "apple", "fig", "pear"]


def test_threshold_is_exclusive(client: TestClient) -> None:
    client.post("/products", json=PEAR)
    assert report(client, 5) == []
    assert report(client, 6) == [{"sku": "pear", "name": "Pear", "stock": 5}]


def test_restock_moves_a_product_off_the_report(client: TestClient) -> None:
    client.post("/products", json=HAMMER)
    assert [row["sku"] for row in report(client, 2)] == ["hammer"]
    client.patch("/products/hammer/stock", json={"amount": 4})
    assert report(client, 2) == []


def test_low_stock_validation(client: TestClient) -> None:
    for below in [0, -3, 1001]:
        r = client.get("/low-stock", params={"below": below})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    for params in [{}, {"below": "few"}]:
        r = client.get("/low-stock", params=params)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert report(client, 1) == []
    assert report(client, 1000) == []
