from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


SYMBOLS: dict[str, int] = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}

STANDARD: list[tuple[int, str]] = [
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
    (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
    (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
]


def _to_roman(n: int) -> str:
    parts: list[str] = []
    for value, symbol in STANDARD:
        count, n = divmod(n, value)
        parts.append(symbol * count)
    return "".join(parts)


def roman_to_int(s: str) -> Ok[int] | Err:
    """Parse a canonical Roman numeral in the range 1..3999."""
    if not s:
        return {"ok": False, "error": "empty"}
    for ch in s:
        if ch not in SYMBOLS:
            return {"ok": False, "error": f"invalid character: {ch}"}

    values = [SYMBOLS[ch] for ch in s]
    total = 0
    for i, value in enumerate(values):
        if i + 1 < len(values) and value < values[i + 1]:
            total -= value
        else:
            total += value

    if not 1 <= total <= 3999 or _to_roman(total) != s:
        return {"ok": False, "error": "not canonical"}
    return {"ok": True, "value": total}
