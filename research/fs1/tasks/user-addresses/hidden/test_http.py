from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
BOB = {**ADA, "email": "bob@example.com", "name": "Bob"}
HOME = {"street": "12 Analytical Row", "city": "London", "postcode": "NW1 6XE"}


def test_add_and_list_addresses(client: TestClient) -> None:
    client.post("/users", json=ADA)
    client.post("/users", json=BOB)
    assert client.get("/users/ada@example.com/addresses").json() == []
    r = client.post("/users/ada@example.com/addresses", json={**HOME, "street": "  12 Analytical Row ", "city": " London"})
    assert r.status_code == 200
    assert r.json() == {"id": 1, "email": "ada@example.com", **HOME}
    bob = client.post("/users/bob@example.com/addresses", json={"street": "1 Main St", "city": "Leeds", "postcode": "LS1"})
    assert bob.json()["id"] == 2
    work = client.post("/users/ada@example.com/addresses", json={"street": "Babbage Yard", "city": "Cambridge", "postcode": " CB2 "})
    assert work.json() == {"id": 3, "email": "ada@example.com", "street": "Babbage Yard", "city": "Cambridge", "postcode": " CB2 "}
    assert client.get("/users/ada@example.com/addresses").json() == [r.json(), work.json()]
    assert client.get("/users/bob@example.com/addresses").json() == [bob.json()]


def test_address_rules(client: TestClient) -> None:
    client.post("/users", json=ADA)
    for bad in [{**HOME, "street": "   "}, {**HOME, "city": ""}, {**HOME, "postcode": "N1"}]:
        r = client.post("/users/ada@example.com/addresses", json=bad)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    r = client.post("/users/ada@example.com/addresses", json={"street": "x", "city": "y"})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    # validation comes before the user check
    r = client.post("/users/nobody@example.com/addresses", json={**HOME, "city": " "})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.post("/users/ada@example.com/addresses", json={**HOME, "postcode": "abc"}).status_code == 200
    assert client.get("/users/ada@example.com/addresses").json()[0]["id"] == 1


def test_addresses_unknown_user(client: TestClient) -> None:
    r = client.post("/users/nobody@example.com/addresses", json=HOME)
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}
    r = client.get("/users/nobody@example.com/addresses")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}
