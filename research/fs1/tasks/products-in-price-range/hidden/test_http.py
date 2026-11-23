from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
FIG = {"sku": "fig", "name": "Fig", "cents": 105, "stock": 2, "tags": []}
GIFT = {"sku": "gift", "name": "Gift card", "cents": 0, "stock": 9, "tags": []}


def in_range(client: TestClient, lo: int, hi: int) -> list[str]:
    r = client.get("/price-range", params={"min_cents": lo, "max_cents": hi})
    assert r.status_code == 200
    return [p["sku"] for p in r.json()]


def test_range_is_inclusive_and_sorted(client: TestClient) -> None:
    for p in [HAMMER, APPLE, PEAR, FIG, GIFT]:
        client.post("/products", json=p)
    assert in_range(client, 80, 105) == ["pear", "apple", "fig"]
    assert in_range(client, 0, 100000) == ["gift", "pear", "apple", "fig", "hammer"]
    assert in_range(client, 105, 105) == ["apple", "fig"]
    assert in_range(client, 0, 0) == ["gift"]
    assert in_range(client, 106, 1998) == []


def test_range_returns_whole_products(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    r = client.get("/price-range", params={"min_cents": 100, "max_cents": 200})
    assert r.json() == [APPLE]


def test_empty_catalog(client: TestClient) -> None:
    assert in_range(client, 0, 10) == []


def test_range_validation(client: TestClient) -> None:
    for lo, hi in [(-1, 10), (10, 9), (-5, -1)]:
        r = client.get("/price-range", params={"min_cents": lo, "max_cents": hi})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    for params in [{"min_cents": 1}, {"max_cents": 1}, {"min_cents": "x", "max_cents": 5}]:
        r = client.get("/price-range", params=params)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert in_range(client, 7, 7) == []
