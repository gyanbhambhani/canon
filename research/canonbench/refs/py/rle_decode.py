from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def _is_digit(ch: str) -> bool:
    return "0" <= ch <= "9"


def rle_decode(s: str) -> Ok[str] | Err:
    """Decode a run-length encoded string such as "a3bc2"."""
    if s and _is_digit(s[0]):
        return {"ok": False, "error": "missing character before count"}

    parts: list[str] = []
    i = 0
    while i < len(s):
        ch = s[i]
        j = i + 1
        while j < len(s) and _is_digit(s[j]):
            j += 1
        count = s[i + 1 : j]
        if not count:
            parts.append(ch)
        elif count[0] == "0":
            return {"ok": False, "error": f"bad count for {ch}"}
        else:
            parts.append(ch * int(count))
        i = j
    return {"ok": True, "value": "".join(parts)}
