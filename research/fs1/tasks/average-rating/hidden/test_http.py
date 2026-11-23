import pytest
from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}


def test_rate_and_average(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/products", json=PEAR)
    r = client.post("/products/apple/ratings", json={"stars": 5})
    assert r.status_code == 200 and r.json() == {"sku": "apple", "count": 1, "average": 5}
    assert client.post("/products/apple/ratings", json={"stars": 4}).json() == {"sku": "apple", "count": 2, "average": 4.5}
    client.post("/products/pear/ratings", json={"stars": 1})
    r = client.get("/products/apple/rating")
    assert r.status_code == 200 and r.json() == {"sku": "apple", "count": 2, "average": 4.5}
    third = client.post("/products/apple/ratings", json={"stars": 4}).json()
    assert third["sku"] == "apple" and third["count"] == 3
    assert third["average"] == pytest.approx(13 / 3)
    assert client.get("/products/pear/rating").json() == {"sku": "pear", "count": 1, "average": 1}


def test_no_ratings_yet(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    r = client.get("/products/apple/rating")
    assert r.status_code == 200 and r.json() == {"sku": "apple", "count": 0, "average": None}


def test_stars_validation(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    for body in [{"stars": 0}, {"stars": 6}, {"stars": -1}, {}]:
        r = client.post("/products/apple/ratings", json=body)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/products/apple/rating").json()["count"] == 0
    assert client.post("/products/apple/ratings", json={"stars": 1}).status_code == 200


def test_unknown_product(client: TestClient) -> None:
    r = client.post("/products/nope/ratings", json={"stars": 3})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
    r = client.get("/products/nope/rating")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
