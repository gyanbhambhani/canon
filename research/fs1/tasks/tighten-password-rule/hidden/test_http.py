from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse 9"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_strong_password_signup_and_login(client: TestClient) -> None:
    r = client.post("/users", json={**ADA, "name": " Ada "})
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/login", json={**ADA, "password": "wrong password 1"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}


def test_password_length_rule(client: TestClient) -> None:
    for password in ["", "short1", "password123", "elevenchar1"]:
        r = client.post("/users", json={**ADA, "password": password})
        assert r.status_code == 422 and kind(r) == "ValidationError", password
    # length is checked before the digit
    r = client.post("/users", json={**ADA, "password": "eightchr"})
    assert r.status_code == 422 and kind(r) == "ValidationError"
    assert client.post("/users", json={**ADA, "password": "twelvechars1"}).status_code == 200


def test_password_needs_a_digit(client: TestClient) -> None:
    for password in ["correct horse", "abcdefghijkl", "twelve chars!"]:
        r = client.post("/users", json={**ADA, "password": password})
        assert r.status_code == 400 and r.json() == {"error": {"kind": "WeakPassword"}}, password
    assert client.get("/customers").json() == []
    for i, password in enumerate(["0bcdefghijkl", "abcdefghijk9", "abcde5ghijkl"]):
        r = client.post("/users", json={**ADA, "email": f"u{i}@example.com", "password": password})
        assert r.status_code == 200, password


def test_other_rules_and_order(client: TestClient) -> None:
    for bad in [{**ADA, "email": "ada"}, {**ADA, "name": "   "}]:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"
    client.post("/users", json=ADA)
    # a weak password is reported before a taken email
    r = client.post("/users", json={**ADA, "password": "correct horse"})
    assert r.status_code == 400 and r.json() == {"error": {"kind": "WeakPassword"}}


def test_reports_with_strong_passwords(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 1, "spent": 315},
        {"email": "bob@example.com", "orders": 1, "spent": 105},
    ]
    assert client.get("/customers").json() == [["Ada", 2]]
    assert client.get("/orders/first").json() == "bob@example.com"
