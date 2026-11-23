from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_query(s: str) -> Ok[list[tuple[str, str]]] | Err:
    """Parse a URL query string into (key, value) pairs, decoding "+" as a space."""
    pairs: list[tuple[str, str]] = []
    for item in s.split("&"):
        if not item:
            continue
        key, _, value = item.partition("=")
        key = key.replace("+", " ")
        if not key:
            return {"ok": False, "error": f"empty key: {item}"}
        pairs.append((key, value.replace("+", " ")))
    return {"ok": True, "value": pairs}
