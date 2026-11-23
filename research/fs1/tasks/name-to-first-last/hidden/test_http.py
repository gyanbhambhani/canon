from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "first_name": "Ada", "last_name": "Lovelace", "password": "correct horse"}
PLATO = {"email": "plato@example.com", "first_name": "Plato", "last_name": "", "password": "correct horse"}
LOGIN = {"email": "ada@example.com", "password": "correct horse"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
ADA_PROFILE = {"email": "ada@example.com", "first_name": "Ada", "last_name": "Lovelace"}


def kind(r: object) -> str:
    return r.json()["error"]["kind"]  # type: ignore[attr-defined,no-any-return]


def test_signup_and_login_with_two_names(client: TestClient) -> None:
    r = client.post("/users", json={**ADA, "first_name": " Ada ", "last_name": "  Lovelace "})
    assert r.status_code == 200 and r.json() == ADA_PROFILE
    r = client.post("/users", json=ADA)
    assert r.status_code == 400 and r.json()["error"] == {"kind": "Taken", "email": "ada@example.com"}
    assert client.post("/login", json=LOGIN).json() == ADA_PROFILE
    assert client.post("/login", json={**LOGIN, "name": "Ada"}).json() == ADA_PROFILE
    r = client.post("/login", json={**LOGIN, "password": "wrong password"})
    assert r.status_code == 400 and r.json()["error"] == {"kind": "BadLogin"}


def test_single_name(client: TestClient) -> None:
    r = client.post("/users", json={**PLATO, "last_name": "   "})
    assert r.status_code == 200
    assert r.json() == {"email": "plato@example.com", "first_name": "Plato", "last_name": ""}


def test_name_rules(client: TestClient) -> None:
    bads = [
        {**ADA, "email": "ada"},
        {**ADA, "first_name": "   "},
        {**ADA, "first_name": ""},
        {**ADA, "password": "short"},
        {k: v for k, v in ADA.items() if k != "last_name"},
        {k: v for k, v in ADA.items() if k != "first_name"},
        {"email": "ada@example.com", "name": "Ada", "password": "correct horse"},
    ]
    for bad in bads:
        r = client.post("/users", json=bad)
        assert r.status_code == 422 and kind(r) == "ValidationError", bad


def test_customers_show_full_names(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/users", json=PLATO)
    client.post("/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 3}]})
    assert client.get("/summaries").json() == [
        {"email": "ada@example.com", "orders": 1, "spent": 315},
        {"email": "bob@example.com", "orders": 1, "spent": 105},
    ]
    assert client.get("/customers").json() == [["Ada Lovelace", 2], ["Plato", 3]]
    assert client.get("/orders/first").json() == "bob@example.com"
