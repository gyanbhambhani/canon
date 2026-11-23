from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse", "terms_accepted": True}
LOGIN = {"email": "ada@example.com", "password": "correct horse"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_signup_with_terms_and_login(client: TestClient) -> None:
    r = client.post("/users", json={**ADA, "name": " Ada "})
    assert r.status_code == 200 and r.json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    assert client.post("/login", json=LOGIN).json() == {"email": "ada@example.com", "name": "Ada"}
    assert client.post("/login", json={**LOGIN, "name": "Ada"}).json() == {"email": "ada@example.com", "name": "Ada"}
    r = client.post("/login", json={**LOGIN, "password": "wrong password"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}


def test_terms_rule(client: TestClient) -> None:
    r = client.post("/users", json={**ADA, "terms_accepted": False})
    assert r.status_code == 422 and kind(r) == "ValidationError"
    no_terms = {k: v for k, v in ADA.items() if k != "terms_accepted"}
    r = client.post("/users", json=no_terms)
    assert r.status_code == 422 and kind(r) == "ValidationError"
    r = client.post("/login", json=LOGIN)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}, "no account was created"


def test_other_signup_rules_still_apply(client: TestClient) -> None:
    for bad in [{**ADA, "email": "ada"}, {**ADA, "name": "   "}, {**ADA, "password": "short"}]:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError"


def test_reports_with_terms(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    assert client.get("/customers").json() == [["Ada", 2]]
    assert client.get("/orders/first").json() == "bob@example.com"
