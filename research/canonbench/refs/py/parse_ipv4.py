from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_ipv4(s: str) -> Ok[int] | Err:
    """Parse a dotted-quad IPv4 address into its 32-bit integer value."""
    parts = s.split(".")
    if len(parts) != 4:
        return {"ok": False, "error": "expected 4 parts"}
    value = 0
    for part in parts:
        octet = _parse_octet(part)
        if octet is None:
            return {"ok": False, "error": f"bad part: {part}"}
        value = value * 256 + octet
    return {"ok": True, "value": value}


def _parse_octet(part: str) -> int | None:
    """Return the value of a 1-3 digit part without leading zeros and at most 255, else None."""
    if not 1 <= len(part) <= 3 or any(ch not in "0123456789" for ch in part):
        return None
    if len(part) > 1 and part[0] == "0":
        return None
    octet = int(part)
    return octet if octet <= 255 else None
