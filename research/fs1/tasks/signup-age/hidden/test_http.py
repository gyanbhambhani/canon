from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse", "age": 36}
LOGIN = {"email": "ada@example.com", "name": "", "password": "correct horse"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def test_signup_with_age_and_login(client: TestClient) -> None:
    r = client.post("/users", json={**ADA, "name": " Ada "})
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada", "age": 36}
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    assert client.post("/login", json=LOGIN).json() == {"email": "ada@example.com", "name": "Ada", "age": 36}
    r = client.post("/login", json={**LOGIN, "password": "wrong password"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}


def test_age_rule(client: TestClient) -> None:
    for age in [12, 0, -5]:
        r = client.post("/users", json={**ADA, "age": age})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    no_age = {k: v for k, v in ADA.items() if k != "age"}
    r = client.post("/users", json=no_age)
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.post("/users", json={**ADA, "age": 13}).status_code == 200


def test_other_signup_rules_still_apply(client: TestClient) -> None:
    for bad in [{**ADA, "email": "ada"}, {**ADA, "name": "   "}, {**ADA, "password": "short"}]:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"


def test_reports_with_aged_users(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 1, "spent": 315},
        {"email": "bob@example.com", "orders": 1, "spent": 105},
    ]
    assert client.get("/customers").json() == [["Ada", 2]]
