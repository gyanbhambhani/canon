from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_duration(s: str) -> Ok[int] | Err:
    """Parse a duration such as "1h30m15s" into seconds."""
    if not s:
        return {"ok": False, "error": "empty"}
    total = 0
    digits = ""
    last_rank = -1
    for ch in s:
        if ch in _DIGITS:
            digits += ch
            continue
        if ch not in _UNITS:
            return {"ok": False, "error": f"unknown unit: {ch}"}
        if not digits:
            return {"ok": False, "error": f"missing number before {ch}"}
        rank, seconds = _UNITS[ch]
        if rank <= last_rank:
            return {"ok": False, "error": f"unit out of order: {ch}"}
        total += int(digits) * seconds
        last_rank = rank
        digits = ""
    if digits:
        return {"ok": False, "error": "missing unit"}
    return {"ok": True, "value": total}


_DIGITS = frozenset("0123456789")
# Unit letter -> (position in the required d, h, m, s order, seconds per unit).
_UNITS: dict[str, tuple[int, int]] = {"d": (0, 86400), "h": (1, 3600), "m": (2, 60), "s": (3, 1)}
