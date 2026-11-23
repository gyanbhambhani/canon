from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "full_name": "Ada Lovelace", "password": "correct horse"}
LOGIN = {"email": "ada@example.com", "password": "correct horse"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_signup_and_login_with_full_name(client: TestClient) -> None:
    r = client.post("/users", json={**ADA, "full_name": "  Ada Lovelace "})
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "full_name": "Ada Lovelace"}
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    r = client.post("/login", json=LOGIN)
    assert r.status_code == 200
    assert r.json() == {"email": "ada@example.com", "full_name": "Ada Lovelace"}
    r = client.post("/login", json={**LOGIN, "name": "ignored"})
    assert r.json() == {"email": "ada@example.com", "full_name": "Ada Lovelace"}
    r = client.post("/login", json={**LOGIN, "password": "wrong password"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}


def test_full_name_rules(client: TestClient) -> None:
    for bad in [{**ADA, "email": "ada"}, {**ADA, "full_name": "   "}, {**ADA, "password": "short"}]:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"
    old_shape = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
    r = client.post("/users", json=old_shape)
    assert r.status_code == 422 and kind(r) == "ValidationError"


def test_reports_with_full_names(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 1, "spent": 315},
        {"email": "bob@example.com", "orders": 1, "spent": 105},
    ]
    assert client.get("/customers").json() == [["Ada Lovelace", 2]]
    assert client.get("/orders/first").json() == "bob@example.com"
