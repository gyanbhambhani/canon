from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Line(TypedDict):
    sku: str
    qty: int
    unit_cents: int


def invoice_total(lines: list[Line], coupon: str) -> Ok[int] | Err:
    """Total an invoice in cents: bulk discounts, a coupon, then 8% tax (halves round up)."""
    for line in lines:
        if line["qty"] < 1:
            return {"ok": False, "error": f"bad quantity: {line['sku']}"}
    subtotal = sum(_line_amount(line) for line in lines)
    discounted = _apply_coupon(subtotal, coupon)
    if isinstance(discounted, str):
        return {"ok": False, "error": discounted}
    tax = (discounted * 8 + 50) // 100
    return {"ok": True, "value": discounted + tax}


def _line_amount(line: Line) -> int:
    """qty * unit price, less a bulk discount (rounded down): 10% from 10 units, 20% from 50."""
    amount = line["qty"] * line["unit_cents"]
    if line["qty"] >= 50:
        amount -= amount // 5
    elif line["qty"] >= 10:
        amount -= amount // 10
    return amount


def _apply_coupon(subtotal: int, coupon: str) -> int | str:
    """Return the amount after the coupon, or an error message."""
    match coupon:
        case "":
            return subtotal
        case "SAVE500":
            return max(0, subtotal - 500)
        case "PCT10":
            return subtotal - subtotal // 10
        case "BIG20":
            if subtotal < 10000:
                return "coupon not applicable: BIG20"
            return subtotal - subtotal // 5
        case _:
            return f"unknown coupon: {coupon}"
