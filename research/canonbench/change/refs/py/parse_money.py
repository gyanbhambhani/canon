from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_money(s: str) -> Ok[int] | Err:
    """Parse an amount such as "-$1,234.56" into signed cents."""
    parenthesized = s.startswith("(")
    if parenthesized:
        if len(s) < 2 or not s.endswith(")"):
            return {"ok": False, "error": "unbalanced parentheses"}
        body = s[1:-1]
        negative = True
    else:
        negative = s.startswith("-")
        body = s[1:] if negative else s
    if not body.startswith("$"):
        return {"ok": False, "error": "missing $"}
    dollars_text, dot, cents_text = body[1:].partition(".")
    if dot and not (len(cents_text) == 2 and _all_digits(cents_text)):
        return {"ok": False, "error": "bad cents"}
    dollars = _parse_dollars(dollars_text)
    if dollars is None:
        return {"ok": False, "error": "bad dollars"}
    cents = dollars * 100 + (int(cents_text) if dot else 0)
    return {"ok": True, "value": -cents if negative else cents}


def _all_digits(text: str) -> bool:
    """True if every character is an ASCII digit (vacuously true for "")."""
    return all("0" <= ch <= "9" for ch in text)


def _parse_dollars(text: str) -> int | None:
    """Validate plain or comma-grouped dollars without a leading zero; return the value."""
    head, *groups = text.split(",")
    if not head or not _all_digits(head):
        return None
    if groups and (len(head) > 3 or any(len(g) != 3 or not _all_digits(g) for g in groups)):
        return None
    digits = head + "".join(groups)
    if len(digits) > 1 and digits[0] == "0":
        return None
    return int(digits)
