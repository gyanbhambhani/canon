from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Green APPLE", "cents": 105, "stock": 3, "tags": ["fruit"]}
JUICE = {"sku": "juice", "name": "Pineapple juice", "cents": 350, "stock": 2, "tags": []}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
ODD = {"sku": "odd", "name": "50% off_sale", "cents": 1, "stock": 1, "tags": []}


def search(client: TestClient, q: str) -> list[str]:
    r = client.get("/search", params={"q": q})
    assert r.status_code == 200
    return [p["sku"] for p in r.json()]


def test_search_by_name_ignoring_case(client: TestClient) -> None:
    for p in [PEAR, JUICE, APPLE]:
        client.post("/products", json=p)
    assert search(client, "apple") == ["apple", "juice"]
    assert search(client, "APPLE") == ["apple", "juice"]
    assert search(client, "aPpLe JUI") == ["juice"]
    assert search(client, "n a") == ["apple"]
    assert search(client, "pe") == ["pear"]
    assert search(client, "kiwi") == []


def test_search_returns_whole_products(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    r = client.get("/search", params={"q": "green"})
    assert r.json() == [APPLE]


def test_search_matches_other_characters_literally(client: TestClient) -> None:
    client.post("/products", json=ODD)
    client.post("/products", json=PEAR)
    assert search(client, "0%") == ["odd"]
    assert search(client, "f_s") == ["odd"]
    assert search(client, "f%") == []
    assert search(client, "p_") == []


def test_search_validation(client: TestClient) -> None:
    for q in ["", "a", "x" * 51]:
        r = client.get("/search", params={"q": q})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    r = client.get("/search")
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/search", params={"q": "ab"}).status_code == 200
    assert client.get("/search", params={"q": "x" * 50}).status_code == 200
