from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def place(client: TestClient) -> dict[str, object]:
    client.post("/products", json=APPLE)
    lines = [{"sku": "apple", "quantity": 1}]
    return client.post("/orders", json={"email": "ada@example.com", "lines": lines}).json()  # type: ignore[no-any-return]


def test_set_and_get_a_note(client: TestClient) -> None:
    order = place(client)
    r = client.get("/orders/1/note")
    assert r.status_code == 200 and r.json() == {"id": 1, "note": ""}
    r = client.put("/orders/1/note", json={"note": " back door "})
    assert r.status_code == 200 and r.json() == {"id": 1, "note": " back door "}
    assert client.get("/orders/1/note").json() == {"id": 1, "note": " back door "}
    r = client.put("/orders/1/note", json={"note": "front porch"})
    assert r.json() == {"id": 1, "note": "front porch"}
    assert client.get("/orders/1/note").json() == {"id": 1, "note": "front porch"}
    # the order itself is unchanged
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1
    paid = client.post("/orders/1/pay").json()
    assert paid == {**order, "status": {"kind": "Paid", "receipt": "test-receipt-105"}}


def test_notes_on_paid_orders_and_separate_orders(client: TestClient) -> None:
    place(client)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 2}]})
    client.post("/orders/1/pay")
    assert client.put("/orders/1/note", json={"note": "gift"}).json() == {"id": 1, "note": "gift"}
    assert client.get("/orders/2/note").json() == {"id": 2, "note": ""}


def test_note_length_bounds(client: TestClient) -> None:
    place(client)
    fifty = "x" * 50
    r = client.put("/orders/1/note", json={"note": fifty})
    assert r.status_code == 200 and r.json()["note"] == fifty
    for bad in ["", "   ", "x" * 51, " " + "y" * 50]:
        r = client.put("/orders/1/note", json={"note": bad})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError", bad
    assert client.get("/orders/1/note").json() == {"id": 1, "note": fifty}
    r = client.put("/orders/1/note", json={})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"


def test_unknown_order(client: TestClient) -> None:
    r = client.put("/orders/7/note", json={"note": "hello"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "order 7"}}
    r = client.get("/orders/7/note")
    assert r.status_code == 400 and r.json() == {"error": {"kind": "Missing", "sku": "order 7"}}
    # validation comes first
    r = client.put("/orders/7/note", json={"note": "  "})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
