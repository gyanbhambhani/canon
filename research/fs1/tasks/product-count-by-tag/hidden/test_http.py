from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit", "red"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
TWICE = {"sku": "twice", "name": "Twice", "cents": 5, "stock": 5, "tags": ["sale", "fruit", "sale"]}
PLAIN = {"sku": "plain", "name": "Plain", "cents": 5, "stock": 5, "tags": []}


def test_counts_per_tag(client: TestClient) -> None:
    for p in [PEAR, HAMMER, APPLE, TWICE, PLAIN]:
        client.post("/products", json=p)
    r = client.get("/tags/counts")
    assert r.status_code == 200
    assert r.json() == [
        {"tag": "fruit", "count": 3},
        {"tag": "heavy", "count": 1},
        {"tag": "red", "count": 1},
        {"tag": "sale", "count": 1},
        {"tag": "tool", "count": 1},
    ]


def test_no_tags(client: TestClient) -> None:
    assert client.get("/tags/counts").json() == []
    client.post("/products", json=PLAIN)
    assert client.get("/tags/counts").json() == []


def test_counts_follow_deletes(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=PEAR)
    client.delete("/products/pear")
    assert client.get("/tags/counts").json() == [{"tag": "fruit", "count": 1}, {"tag": "red", "count": 1}]
