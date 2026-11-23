from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_free_products_are_rejected(client: TestClient) -> None:
    for cents in [0, -1, -500]:
        r = client.post("/products", json={**APPLE, "cents": cents})
        assert r.status_code == 422 and kind(r) == "ValidationError"
    r = client.get("/products/apple")
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Missing", "sku": "apple"}


def test_one_cent_is_the_lowest_price(client: TestClient) -> None:
    cheap = {**APPLE, "cents": 1}
    r = client.post("/products", json=cheap)
    assert r.status_code == 200 and r.json() == cheap
    assert client.get("/products/apple").json() == cheap
    assert client.get("/prices").json() == {"apple": "$0.01"}


def test_other_product_rules_still_apply(client: TestClient) -> None:
    for bad in [{**APPLE, "sku": "ab"}, {**APPLE, "stock": -1}, {**APPLE, "sku": "ab", "cents": 0}]:
        r = client.post("/products", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"
    assert client.post("/products", json={**APPLE, "stock": 0}).status_code == 200
