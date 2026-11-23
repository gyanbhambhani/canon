from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}


def test_add_and_list_reviews(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=PEAR)
    r = client.post("/products/apple/reviews", json={"rating": 5, "text": "  Crisp and sweet "})
    assert r.status_code == 200
    assert r.json() == {"id": 1, "sku": "apple", "rating": 5, "text": "  Crisp and sweet "}
    assert client.post("/products/pear/reviews", json={"rating": 2, "text": "Mealy"}).json()["id"] == 2
    client.post("/products/apple/reviews", json={"rating": 1, "text": "Bruised"})
    r = client.get("/products/apple/reviews")
    assert r.status_code == 200
    assert r.json() == [
        {"id": 1, "sku": "apple", "rating": 5, "text": "  Crisp and sweet "},
        {"id": 3, "sku": "apple", "rating": 1, "text": "Bruised"},
    ]
    assert client.get("/products/pear/reviews").json() == [{"id": 2, "sku": "pear", "rating": 2, "text": "Mealy"}]


def test_no_reviews_yet(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    r = client.get("/products/apple/reviews")
    assert r.status_code == 200 and r.json() == []


def test_review_validation(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    bad = [
        {"rating": 0, "text": "ok"},
        {"rating": 6, "text": "ok"},
        {"rating": 3, "text": ""},
        {"rating": 3, "text": "    "},
        {"rating": 3, "text": "x" * 501},
        {"rating": 3},
        {"text": "ok"},
    ]
    for body in bad:
        r = client.post("/products/apple/reviews", json=body)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError", body
    assert client.get("/products/apple/reviews").json() == []
    for body in [{"rating": 1, "text": "x"}, {"rating": 5, "text": "x" * 500}]:
        assert client.post("/products/apple/reviews", json=body).status_code == 200


def test_unknown_product(client: TestClient) -> None:
    r = client.post("/products/nope/reviews", json={"rating": 3, "text": "fine"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
    r = client.get("/products/nope/reviews")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
