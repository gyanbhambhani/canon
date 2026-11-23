"""SQLite storage. The database file is $SHOP_DATABASE (default shop.db)."""

import os
import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    pos INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    cents INTEGER NOT NULL,
    stock INTEGER NOT NULL,
    tags TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    pos INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    id TEXT NOT NULL,
    phone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    lines TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL
);
"""

_lock = threading.RLock()
_connection: sqlite3.Connection | None = None


def _connect() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        path = os.environ.get("SHOP_DATABASE", "shop.db")
        _connection = sqlite3.connect(path, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.executescript(SCHEMA)
    return _connection


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """A connection for one unit of work, committed at the end."""
    with _lock:
        conn = _connect()
        with conn:
            yield conn


def reset() -> None:
    """Close the database; the next request opens $SHOP_DATABASE again."""
    global _connection
    with _lock:
        if _connection is not None:
            _connection.close()
        _connection = None
