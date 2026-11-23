import pytest
from fastapi.testclient import TestClient


def add(client: TestClient, sku: str, name: str) -> None:
    client.post("/products", json={"sku": sku, "name": name, "cents": 100, "stock": 1, "tags": []})


def rate(client: TestClient, sku: str, *stars: int) -> None:
    for s in stars:
        assert client.post(f"/products/{sku}/ratings", json={"stars": s}).status_code == 200


def top(client: TestClient, limit: int) -> list[dict[str, object]]:
    r = client.get("/top-rated", params={"limit": limit})
    assert r.status_code == 200
    return r.json()  # type: ignore[no-any-return]


def test_rate_returns_the_summary(client: TestClient) -> None:
    add(client, "apple", "Apple")
    r = client.post("/products/apple/ratings", json={"stars": 5})
    assert r.status_code == 200 and r.json() == {"sku": "apple", "count": 1, "average": 5}
    assert client.post("/products/apple/ratings", json={"stars": 4}).json() == {"sku": "apple", "count": 2, "average": 4.5}
    third = client.post("/products/apple/ratings", json={"stars": 4}).json()
    assert third["count"] == 3 and third["average"] == pytest.approx(13 / 3)


def test_top_rated_order_and_limit(client: TestClient) -> None:
    for sku, name in [("plum", "Plum"), ("apple", "Apple"), ("kiwi", "Kiwi"), ("pear", "Pear"), ("fig", "Fig")]:
        add(client, sku, name)
    rate(client, "plum", 4, 3)
    rate(client, "apple", 5, 4, 4)
    rate(client, "kiwi", 5)
    rate(client, "pear", 3, 4)
    rows = top(client, 10)
    assert [r["sku"] for r in rows] == ["kiwi", "apple", "pear", "plum"]
    assert rows[0] == {"sku": "kiwi", "name": "Kiwi", "average": 5, "count": 1}
    assert rows[1]["name"] == "Apple" and rows[1]["count"] == 3
    assert rows[1]["average"] == pytest.approx(13 / 3)
    assert rows[2] == {"sku": "pear", "name": "Pear", "average": 3.5, "count": 2}
    assert [r["sku"] for r in top(client, 2)] == ["kiwi", "apple"]
    assert [r["sku"] for r in top(client, 1)] == ["kiwi"]


def test_no_ratings(client: TestClient) -> None:
    add(client, "apple", "Apple")
    assert top(client, 5) == []


def test_validation(client: TestClient) -> None:
    add(client, "apple", "Apple")
    for body in [{"stars": 0}, {"stars": 6}, {}]:
        r = client.post("/products/apple/ratings", json=body)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    for limit in [0, -1, 21]:
        r = client.get("/top-rated", params={"limit": limit})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/top-rated", params={"limit": 20}).status_code == 200
    assert top(client, 20) == []


def test_unknown_product(client: TestClient) -> None:
    r = client.post("/products/nope/ratings", json={"stars": 3})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
