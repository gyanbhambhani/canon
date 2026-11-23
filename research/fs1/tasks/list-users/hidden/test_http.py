from fastapi.testclient import TestClient


def signup(client: TestClient, email: str, name: str) -> None:
    r = client.post("/users", json={"email": email, "name": name, "password": "correct horse"})
    assert r.status_code == 200


def test_list_users_pages(client: TestClient) -> None:
    for email, name in [("cy@example.com", "Cy"), ("ada@example.com", "Ada"), ("Zed@example.com", "Zed"), ("bob@example.com", "Bob")]:
        signup(client, email, name)
    r = client.get("/users", params={"page": 1, "per_page": 3})
    assert r.status_code == 200
    assert r.json() == [
        {"email": "Zed@example.com", "name": "Zed"},
        {"email": "ada@example.com", "name": "Ada"},
        {"email": "bob@example.com", "name": "Bob"},
    ]
    assert client.get("/users", params={"page": 2, "per_page": 3}).json() == [{"email": "cy@example.com", "name": "Cy"}]
    assert client.get("/users", params={"page": 3, "per_page": 3}).json() == []
    assert len(client.get("/users", params={"page": 1, "per_page": 25}).json()) == 4


def test_list_users_empty(client: TestClient) -> None:
    r = client.get("/users", params={"page": 1, "per_page": 10})
    assert r.status_code == 200 and r.json() == []


def test_list_users_validation(client: TestClient) -> None:
    for page, per_page in [(0, 10), (-1, 10), (1, 0), (1, 26), (1, -3)]:
        r = client.get("/users", params={"page": page, "per_page": per_page})
        assert r.status_code == 422 and r.json()["error"]["kind"] == "ValidationError"
    assert client.get("/users", params={"page": 1, "per_page": 25}).status_code == 200
    assert client.get("/users", params={"page": 1, "per_page": 1}).status_code == 200
