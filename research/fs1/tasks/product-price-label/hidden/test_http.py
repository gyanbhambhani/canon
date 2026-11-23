from fastapi.testclient import TestClient


def product(sku: str, cents: int) -> dict[str, object]:
    return {"sku": sku, "name": f"Item {sku}", "cents": cents, "stock": 1, "tags": []}


def test_price_labels(client: TestClient) -> None:
    cases = {"aaa": (105, "$1.05"), "bbb": (5, "$0.05"), "ccc": (0, "$0.00"), "ddd": (123456, "$1234.56"),
             "eee": (1999, "$19.99"), "fff": (100, "$1.00"), "ggg": (110, "$1.10")}
    for sku, (cents, _) in cases.items():
        client.post("/products", json=product(sku, cents))
    for sku, (_, label) in cases.items():
        r = client.get(f"/products/{sku}/label")
        assert r.status_code == 200
        assert r.json() == {"sku": sku, "name": f"Item {sku}", "price_label": label}


def test_label_of_an_unknown_product(client: TestClient) -> None:
    r = client.get("/products/nope/label")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
