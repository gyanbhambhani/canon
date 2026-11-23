from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit", "red"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
TWICE = {"sku": "twice", "name": "Twice", "cents": 5, "stock": 5, "tags": ["sale", "sale"]}
PLAIN = {"sku": "plain", "name": "Plain", "cents": 5, "stock": 5, "tags": []}


def test_distinct_sorted_tags(client: TestClient) -> None:
    for p in [PEAR, HAMMER, APPLE, TWICE, PLAIN]:
        client.post("/products", json=p)
    r = client.get("/tags")
    assert r.status_code == 200
    assert r.json() == ["fruit", "heavy", "red", "sale", "tool"]


def test_no_tags(client: TestClient) -> None:
    assert client.get("/tags").json() == []
    client.post("/products", json=PLAIN)
    assert client.get("/tags").json() == []


def test_deleted_products_tags_are_gone(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=PEAR)
    client.delete("/products/apple")
    assert client.get("/tags").json() == ["fruit"]
