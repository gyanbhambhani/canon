"""pytest setup for FS-1's HTTP tests, the same in every arm.

The harness sets FS1_BACKEND to an arm's backend folder. Every arm's backend/main.py exposes
`app` (FastAPI) and `reset_database()`, reads its database from $SHOP_DATABASE, and replaces the
payment provider with a fake when SHOP_FAKE_PAYMENTS=1.
"""

import os
import sys
import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

BACKEND = os.environ.get("FS1_BACKEND")
if BACKEND:
    sys.path.insert(0, BACKEND)
os.environ["SHOP_FAKE_PAYMENTS"] = "1"
_tmp = tempfile.mkdtemp(prefix="fs1-db-")
_count = 0


@pytest.fixture
def client() -> Iterator[TestClient]:
    """A test client on a fresh, empty database."""
    global _count
    _count += 1
    path = os.path.join(_tmp, f"test-{_count}.db")
    os.environ["SHOP_DATABASE"] = path
    import main

    main.reset_database()
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c
    main.reset_database()
