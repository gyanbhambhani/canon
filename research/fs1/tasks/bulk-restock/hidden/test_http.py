from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}


def stock(client: TestClient, sku: str) -> int:
    return client.get(f"/products/{sku}").json()["stock"]  # type: ignore[no-any-return]


def setup(client: TestClient) -> None:
    for p in [APPLE, PEAR, HAMMER]:
        client.post("/products", json=p)


def test_restock_several_products(client: TestClient) -> None:
    setup(client)
    r = client.post("/restock", json={"items": [{"sku": "pear", "amount": 10}, {"sku": "apple", "amount": 2}]})
    assert r.status_code == 200
    assert r.json() == [{**PEAR, "stock": 15}, {**APPLE, "stock": 5}]
    assert stock(client, "pear") == 15 and stock(client, "apple") == 5 and stock(client, "hammer") == 1


def test_a_sku_twice_adds_up(client: TestClient) -> None:
    setup(client)
    items = [{"sku": "hammer", "amount": 2}, {"sku": "apple", "amount": 1}, {"sku": "hammer", "amount": 3}]
    r = client.post("/restock", json={"items": items})
    assert r.status_code == 200
    assert r.json() == [{**HAMMER, "stock": 6}, {**APPLE, "stock": 4}, {**HAMMER, "stock": 6}]
    assert stock(client, "hammer") == 6


def test_unknown_sku_changes_nothing(client: TestClient) -> None:
    setup(client)
    items = [{"sku": "apple", "amount": 2}, {"sku": "kiwi", "amount": 1}, {"sku": "pear", "amount": -1}]
    r = client.post("/restock", json={"items": items})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "kiwi"}}
    assert stock(client, "apple") == 3 and stock(client, "pear") == 5


def test_non_positive_amount_changes_nothing(client: TestClient) -> None:
    setup(client)
    for bad in [0, -4]:
        items = [{"sku": "apple", "amount": 2}, {"sku": "pear", "amount": bad}, {"sku": "kiwi", "amount": 1}]
        r = client.post("/restock", json={"items": items})
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "Invalid", "reason": "amount for pear is not positive"}}
    assert stock(client, "apple") == 3 and stock(client, "pear") == 5


def test_item_count_validation(client: TestClient) -> None:
    setup(client)
    for items in [[], [{"sku": "apple", "amount": 1}] * 21]:
        r = client.post("/restock", json={"items": items})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert stock(client, "apple") == 3
    r = client.post("/restock", json={"items": [{"sku": "apple", "amount": 1}] * 20})
    assert r.status_code == 200 and len(r.json()) == 20
    assert stock(client, "apple") == 23
    r = client.post("/restock", json={"items": [{"sku": "apple"}]})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
