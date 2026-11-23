from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
FIG = {"sku": "fig", "name": "Fig", "cents": 50, "stock": 7, "tags": ["fruit", "dried"]}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def skus(r: object) -> list[str]:
    assert r.status_code == 200  # type: ignore[attr-defined]
    return [p["sku"] for p in r.json()]  # type: ignore[attr-defined]


def add_all(client: TestClient) -> None:
    for p in [PEAR, HAMMER, APPLE, FIG]:
        client.post("/products", json=p)


def test_list_all_products_in_pages(client: TestClient) -> None:
    add_all(client)
    page = lambda p, n: client.get("/products", params={"page": p, "per_page": n})  # noqa: E731
    assert page(1, 3).json() == [APPLE, FIG, HAMMER]
    assert skus(page(2, 3)) == ["pear"]
    assert skus(page(3, 3)) == []
    assert skus(page(1, 50)) == ["apple", "fig", "hammer", "pear"]


def test_list_products_with_a_tag_in_pages(client: TestClient) -> None:
    add_all(client)
    page = lambda t, p, n: client.get(f"/tags/{t}/products", params={"page": p, "per_page": n})  # noqa: E731
    assert page("fruit", 1, 2).json() == [APPLE, FIG]
    assert skus(page("fruit", 2, 2)) == ["pear"]
    assert skus(page("fruit", 3, 2)) == []
    assert skus(page("heavy", 1, 10)) == ["hammer"]
    assert skus(page("dried", 1, 10)) == ["fig"]
    assert skus(page("frui", 1, 10)) == []
    assert skus(page("nothing", 1, 10)) == []


def test_validation_of_both_lists(client: TestClient) -> None:
    add_all(client)
    for p, n in [(0, 2), (-1, 2), (1, 0), (1, 51)]:
        r = client.get("/products", params={"page": p, "per_page": n})
        assert r.status_code == 422 and kind(r) == "ValidationError"
        r = client.get("/tags/fruit/products", params={"page": p, "per_page": n})
        assert r.status_code == 422 and kind(r) == "ValidationError"
    assert client.get("/products", params={"page": 1, "per_page": 50}).status_code == 200
    assert client.get("/tags/fruit/products", params={"page": 1, "per_page": 50}).status_code == 200
    r = client.get("/tags/fruit/products", params={"page": 1})
    assert r.status_code == 422 and kind(r) == "ValidationError"
