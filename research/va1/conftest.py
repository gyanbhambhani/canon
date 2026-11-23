"""pytest setup for VA-1's HTTP tests, the same in every arm.

The harness sets VA1_BACKEND to an arm's backend folder. Every arm's backend/main.py exposes `app`
(FastAPI). The services are stateless: there is no database.
"""

import os
import sys
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

BACKEND = os.environ.get("VA1_BACKEND")
if BACKEND:
    sys.path.insert(0, BACKEND)


@pytest.fixture
def client() -> Iterator[TestClient]:
    """A test client on the arm's app (server errors come back as 500 responses, not exceptions)."""
    import main

    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c
