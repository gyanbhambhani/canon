from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse", "phone": "+4420794600"}
LOGIN = {"email": "ada@example.com", "password": "correct horse"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
ADA_PROFILE = {"email": "ada@example.com", "name": "Ada", "phone": "+4420794600"}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_signup_with_phone_and_login(client: TestClient) -> None:
    r = client.post("/users", json={**ADA, "name": " Ada ", "phone": "  +4420794600 "})
    assert r.status_code == 200 and r.json() == ADA_PROFILE
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    assert client.post("/login", json=LOGIN).json() == ADA_PROFILE
    assert client.post("/login", json={**LOGIN, "name": "Ada"}).json() == ADA_PROFILE
    r = client.post("/login", json={**LOGIN, "password": "wrong password"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}


def test_phone_shapes(client: TestClient) -> None:
    good = ["1234567", "+123456789012345", "5550100200"]
    for i, phone in enumerate(good):
        r = client.post("/users", json={**ADA, "email": f"u{i}@example.com", "phone": phone})
        assert r.status_code == 200 and r.json()["phone"] == phone, phone
    bad = ["123456", "+1234567890123456", "555-0100", "+", "", "   ", "++1234567", "12345678+", "phone123456"]
    for phone in bad:
        r = client.post("/users", json={**ADA, "email": "bad@example.com", "phone": phone})
        assert r.status_code == 400, phone
        assert r.json()["error"] == {"kind": "BadPhone", "phone": phone}
    r = client.post("/login", json={"email": "bad@example.com", "password": "correct horse"})
    assert kind(r) == "BadLogin", "no account with a bad phone"


def test_phone_check_order(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.post("/users", json={**ADA, "phone": "nope"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadPhone", "phone": "nope"}
    r = client.post("/users", json={**ADA, "email": "ada", "phone": "nope"})
    assert r.status_code == 422 and kind(r) == "ValidationError"


def test_phone_is_required_and_other_rules_apply(client: TestClient) -> None:
    no_phone = {k: v for k, v in ADA.items() if k != "phone"}
    for bad in [no_phone, {**ADA, "email": "ada"}, {**ADA, "name": "   "}, {**ADA, "password": "short"}]:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"


def test_reports_with_phones(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    assert client.get("/customers").json() == [["Ada", 2]]
    assert client.get("/orders/first").json() == "bob@example.com"
