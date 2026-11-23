from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
LINES = [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]


def place(client: TestClient) -> dict[str, object]:
    client.post("/products", json=APPLE)
    client.post("/products", json=HAMMER)
    return client.post("/orders", json={"email": "ada@example.com", "lines": LINES}).json()  # type: ignore[no-any-return]


def test_add_a_discount(client: TestClient) -> None:
    r = client.post("/discounts", json={"code": "SAVE10", "percent": 10})
    assert r.status_code == 200 and r.json() == {"code": "SAVE10", "percent": 10}
    r = client.post("/discounts", json={"code": "SAVE10", "percent": 20})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "duplicate code SAVE10"}}


def test_discount_validation(client: TestClient) -> None:
    for bad in [
        {"code": "AB", "percent": 10},
        {"code": "", "percent": 10},
        {"code": "SAVE", "percent": 0},
        {"code": "SAVE", "percent": 101},
        {"code": "SAVE", "percent": -5},
        {"code": "SAVE"},
    ]:
        r = client.post("/discounts", json=bad)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError", bad
    for good in [{"code": "ABC", "percent": 1}, {"code": "ALL", "percent": 100}]:
        assert client.post("/discounts", json=good).json() == good


def test_apply_a_discount_then_pay(client: TestClient) -> None:
    order = place(client)
    client.post("/discounts", json={"code": "SAVE10", "percent": 10})
    r = client.post("/orders/1/discount", json={"code": "SAVE10"})
    assert r.status_code == 200 and r.json() == {**order, "total": 1989}
    paid = client.post("/orders/1/pay").json()
    assert paid["total"] == 1989
    assert paid["status"] == {"kind": "Paid", "receipt": "test-receipt-1989"}


def test_codes_compound_and_round_down(client: TestClient) -> None:
    place(client)
    client.post("/discounts", json={"code": "SAVE10", "percent": 10})
    client.post("/discounts", json={"code": "HALF", "percent": 50})
    client.post("/discounts", json={"code": "FREE", "percent": 100})
    client.post("/orders/1/discount", json={"code": "SAVE10"})  # 2209 -> 1989
    r = client.post("/orders/1/discount", json={"code": "HALF"})  # 1989 -> 995 (994.5 off rounds down to 994)
    assert r.json()["total"] == 995
    assert client.post("/orders/1/discount", json={"code": "FREE"}).json()["total"] == 0


def test_apply_errors_in_order(client: TestClient) -> None:
    r = client.post("/orders/5/discount", json={"code": "NOPE"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "order 5"}}
    place(client)
    r = client.post("/orders/1/discount", json={"code": "NOPE"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "UnknownCode", "code": "NOPE"}}
    client.post("/discounts", json={"code": "SAVE10", "percent": 10})
    client.post("/orders/1/pay")
    for code in ["SAVE10", "NOPE"]:
        r = client.post("/orders/1/discount", json={"code": code})
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is not open"}}
