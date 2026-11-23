from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
BOB = {"email": "bob@example.com", "name": "Bob", "password": "battery staple"}
APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}


def test_change_email(client: TestClient) -> None:
    client.post("/users", json=ADA)
    r = client.patch("/users/ada@example.com/email", json={"new_email": "ada@lovelace.org"})
    assert r.status_code == 200
    assert r.json() == {"email": "ada@lovelace.org", "name": "Ada"}
    login = client.post("/login", json={**ADA, "email": "ada@lovelace.org"})
    assert login.status_code == 200 and login.json() == {"email": "ada@lovelace.org", "name": "Ada"}
    old = client.post("/login", json=ADA)
    assert old.status_code == 400 and old.json()["error"] == {"kind": "BadLogin"}
    # the old email is free again
    assert client.post("/users", json=ADA).status_code == 200


def test_orders_keep_their_email(client: TestClient) -> None:
    client.post("/products", json=APPLE)
    client.post("/users", json=ADA)
    client.post("/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
    client.patch("/users/ada@example.com/email", json={"new_email": "ada@lovelace.org"})
    assert client.get("/orders/first").json() == "ada@example.com"
    assert client.get("/orders/open", params={"email": "ada@example.com"}).json() == 1


def test_email_taken(client: TestClient) -> None:
    client.post("/users", json=ADA)
    client.post("/users", json=BOB)
    r = client.patch("/users/ada@example.com/email", json={"new_email": "bob@example.com"})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Taken", "email": "bob@example.com"}}
    r = client.patch("/users/ada@example.com/email", json={"new_email": "ada@example.com"})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Taken", "email": "ada@example.com"}}
    # nothing changed
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada"}
    assert client.post("/login", json=BOB).json() == {"email": "bob@example.com", "name": "Bob"}


def test_new_email_rule(client: TestClient) -> None:
    client.post("/users", json=ADA)
    for bad in ["", "ada", "ada@example", "a b@example.com"]:
        r = client.patch("/users/ada@example.com/email", json={"new_email": bad})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    r = client.patch("/users/ada@example.com/email", json={})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # validation comes before the user check
    r = client.patch("/users/nobody@example.com/email", json={"new_email": "nope"})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"


def test_change_email_unknown_user(client: TestClient) -> None:
    r = client.patch("/users/nobody@example.com/email", json={"new_email": "somebody@example.com"})
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}
