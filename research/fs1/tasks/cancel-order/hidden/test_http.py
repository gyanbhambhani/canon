from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def place(client: TestClient) -> dict[str, object]:
    client.post("/products", json=APPLE)
    r = client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 2}]})
    return r.json()  # type: ignore[no-any-return]


def test_cancel_an_open_order(client: TestClient) -> None:
    order = place(client)
    r = client.post("/orders/1/cancel")
    assert r.status_code == 200
    assert r.json() == {**order, "status": {"kind": "Cancelled"}}
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 0


def test_cancel_twice(client: TestClient) -> None:
    place(client)
    first = client.post("/orders/1/cancel").json()
    again = client.post("/orders/1/cancel")
    assert again.status_code == 200 and again.json() == first


def test_cancel_a_paid_order(client: TestClient) -> None:
    place(client)
    client.post("/orders/1/pay")
    r = client.post("/orders/1/cancel")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Invalid", "reason": "order 1 is paid"}}


def test_cancel_an_unknown_order(client: TestClient) -> None:
    r = client.post("/orders/7/cancel")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Missing", "sku": "order 7"}}
