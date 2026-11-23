from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Stock(TypedDict):
    sku: str
    qty: int

class Txn(TypedDict):
    sku: str
    delta: int


def inventory_ledger(stock: list[Stock], txns: list[Txn]) -> Ok[list[Stock]] | Err:
    """Apply stock transactions in order; report the first unknown sku or negative balance."""
    quantities: dict[str, int] = {item["sku"]: item["qty"] for item in stock}
    for position, txn in enumerate(txns, start=1):
        sku = txn["sku"]
        if sku not in quantities:
            return {"ok": False, "error": f"txn {position}: unknown sku {sku}"}
        updated = quantities[sku] + txn["delta"]
        if updated < 0:
            return {"ok": False, "error": f"txn {position}: {sku} would go negative"}
        quantities[sku] = updated
    remaining: list[Stock] = [
        {"sku": sku, "qty": qty} for sku, qty in sorted(quantities.items()) if qty > 0
    ]
    return {"ok": True, "value": remaining}
