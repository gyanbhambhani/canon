from fastapi.testclient import TestClient

ADA = {"email": "ada@example.com", "name": "Ada", "password": "correct horse"}
BOB = {**ADA, "email": "bob@example.com", "name": "Bob"}
HOME = {"street": "12 Analytical Row", "city": "London", "postcode": "NW1 6XE"}
WORK = {"street": "Babbage Yard", "city": "Cambridge", "postcode": "CB2"}
PATH = "/users/ada@example.com/default-address"


def test_set_and_get_default_address(client: TestClient) -> None:
    client.post("/users", json=ADA)
    client.post("/users", json=BOB)
    r = client.get(PATH)
    assert r.status_code == 200 and r.json() is None
    r = client.put(PATH, json={**HOME, "street": "  12 Analytical Row ", "city": " London"})
    assert r.status_code == 200 and r.json() == HOME
    assert client.get(PATH).json() == HOME
    assert client.put(PATH, json={**WORK, "postcode": " CB2 "}).json() == {**WORK, "postcode": " CB2 "}
    assert client.get(PATH).json() == {**WORK, "postcode": " CB2 "}
    assert client.get("/users/bob@example.com/default-address").json() is None
    # the account itself is unchanged
    assert client.post("/login", json=ADA).json() == {"email": "ada@example.com", "name": "Ada"}


def test_default_address_rules(client: TestClient) -> None:
    client.post("/users", json=ADA)
    client.put(PATH, json=HOME)
    for bad in [{**WORK, "street": "   "}, {**WORK, "city": ""}, {**WORK, "postcode": "N1"}, {"street": "x", "city": "y"}]:
        r = client.put(PATH, json=bad)
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get(PATH).json() == HOME
    # validation comes before the user check
    r = client.put("/users/nobody@example.com/default-address", json={**HOME, "city": " "})
    assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.put(PATH, json={**HOME, "postcode": "abc"}).status_code == 200


def test_default_address_unknown_user(client: TestClient) -> None:
    for r in [client.put("/users/nobody@example.com/default-address", json=HOME), client.get("/users/nobody@example.com/default-address")]:
        assert r.status_code == 400
        assert r.json() == {"error": {"kind": "NoSuchUser", "email": "nobody@example.com"}}
