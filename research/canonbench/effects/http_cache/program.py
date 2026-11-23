"""A read-through HTTP cache stored as files: first line is the fetch time, then the body."""

import time
import urllib.request
from dataclasses import dataclass


@dataclass
class Entry:
    fetched_at: int
    body: str


def cache_path(dir: str, url: str) -> str:
    """The cache file for `url` inside `dir`."""
    return dir + "/" + "_".join(url.split("://")).replace("/", "_")


def encode_entry(fetched_at: int, body: str) -> str:
    """Serialize a cache entry."""
    return str(fetched_at) + "\n" + body


def decode_entry(text: str) -> Entry | None:
    """Parse a cache file; None if its header is not a timestamp."""
    lines = text.split("\n")
    try:
        fetched_at = int(lines[0])
    except ValueError:
        return None
    return Entry(fetched_at, "\n".join(lines[1:]))


def is_expired(fetched_at: int, now_ms: int, ttl_ms: int) -> bool:
    """True if an entry fetched at `fetched_at` is older than `ttl_ms` at `now_ms`."""
    return now_ms - fetched_at > ttl_ms


def read_cached(dir: str, url: str, ttl_ms: int) -> str | None:
    """The cached body for `url` if present and fresh."""
    try:
        with open(cache_path(dir, url), encoding="utf-8") as f:
            entry = decode_entry(f.read())
    except OSError:
        return None
    if entry is None:
        return None
    return if_fresh(entry.fetched_at, entry.body, ttl_ms)


def if_fresh(fetched_at: int, body: str, ttl_ms: int) -> str | None:
    """`body` unless an entry fetched at `fetched_at` has expired by the wall clock."""
    if is_expired(fetched_at, int(time.time() * 1000), ttl_ms):
        return None
    return body


def fetch_and_store(dir: str, url: str) -> str:
    """Fetch `url` and store it in the cache; returns the body."""
    with urllib.request.urlopen(url, timeout=10) as resp:
        raw: bytes = resp.read()
    body = raw.decode("utf-8")
    with open(cache_path(dir, url), "w", encoding="utf-8") as f:
        f.write(encode_entry(int(time.time() * 1000), body))
    return body


def get_cached(dir: str, url: str, ttl_ms: int) -> str:
    """The body for `url`, from the cache when fresh, otherwise from the network."""
    cached = read_cached(dir, url, ttl_ms)
    if cached is not None:
        return cached
    return fetch_and_store(dir, url)
