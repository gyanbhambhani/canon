from fastapi.testclient import TestClient

APPLE = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
HAMMER = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
PEAR = {"sku": "pear", "name": "Pear", "cents": 80, "stock": 5, "tags": ["fruit"]}
SAW = {"sku": "saw", "name": "Saw", "cents": 1250, "stock": 2, "tags": ["tool"]}


def skus(client: TestClient, **params: object) -> list[str]:
    r = client.get("/products", params={"page": 1, "per_page": 10, **params})
    assert r.status_code == 200
    return [p["sku"] for p in r.json()]


def test_discontinue_returns_the_product(client: TestClient) -> None:
    client.post("/products", json=HAMMER)
    r = client.post("/products/hammer/discontinue")
    assert r.status_code == 200 and r.json() == HAMMER
    again = client.post("/products/hammer/discontinue")
    assert again.status_code == 200 and again.json() == HAMMER
    assert client.get("/products/hammer").json() == HAMMER


def test_discontinued_products_leave_the_list(client: TestClient) -> None:
    for p in [PEAR, SAW, HAMMER, APPLE]:
        client.post("/products", json=p)
    client.post("/products/hammer/discontinue")
    assert skus(client) == ["apple", "pear", "saw"]
    page = lambda n: [p["sku"] for p in client.get("/products", params={"page": n, "per_page": 2}).json()]  # noqa: E731
    assert page(1) == ["apple", "pear"]
    assert page(2) == ["saw"]
    assert skus(client, tag="tool") == ["saw"]
    client.post("/products/apple/discontinue")
    assert skus(client, tag="fruit") == ["pear"]
    assert client.get("/products/apple").json() == APPLE


def test_discontinue_an_unknown_product(client: TestClient) -> None:
    r = client.post("/products/nope/discontinue")
    assert r.status_code == 400
    assert r.json() == {"error": {"kind": "Missing", "sku": "nope"}}
