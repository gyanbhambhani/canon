from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit", "red"]}
CHERRY = {"sku": "cherry", "name": "Cherry", "cents": 20, "stock": 50, "tags": ["red", "fruit", "small"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
TWICE = {"sku": "twice", "name": "Fruit box", "cents": 900, "stock": 2, "tags": ["fruit", "fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PLAIN = {"sku": "plain", "name": "Plain", "cents": 5, "stock": 5, "tags": []}


def related(client: TestClient, sku: str) -> list[str]:
    r = client.get(f"/products/{sku}/related")
    assert r.status_code == 200
    return [p["sku"] for p in r.json()]


def add_all(client: TestClient) -> None:
    for p in [TWICE, HAMMER, PEAR, CHERRY, APPLE, PLAIN]:
        client.post("/products", json=p)


def test_most_shared_tags_first(client: TestClient) -> None:
    add_all(client)
    assert related(client, "apple") == ["cherry", "pear", "twice"]
    assert related(client, "cherry") == ["apple", "pear", "twice"]
    assert related(client, "pear") == ["apple", "cherry", "twice"]


def test_repeated_tags_count_once(client: TestClient) -> None:
    add_all(client)
    client.post("/products", json={**PLAIN, "sku": "redbox", "tags": ["red", "red", "red"]})
    assert related(client, "twice") == ["apple", "cherry", "pear"]
    assert related(client, "apple") == ["cherry", "pear", "redbox", "twice"]


def test_whole_products_and_no_matches(client: TestClient) -> None:
    add_all(client)
    assert client.get("/products/hammer/related").json() == []
    assert client.get("/products/plain/related").json() == []
    assert client.get("/products/twice/related").json()[0] == APPLE


def test_unknown_product(client: TestClient) -> None:
    r = client.get("/products/nope/related")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
