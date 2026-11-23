from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Open(TypedDict):
    kind: Literal["Open"]
    name: str

class Deposit(TypedDict):
    kind: Literal["Deposit"]
    name: str
    amount: int

class Withdraw(TypedDict):
    kind: Literal["Withdraw"]
    name: str
    amount: int

class Transfer(TypedDict):
    kind: Literal["Transfer"]
    src: str
    dst: str
    amount: int

class Close(TypedDict):
    kind: Literal["Close"]
    name: str

BankOp = Open | Deposit | Withdraw | Transfer | Close


class _LedgerError(Exception):
    pass


def _require(balances: dict[str, int], name: str) -> None:
    if name not in balances:
        raise _LedgerError(f"unknown account {name}")


def _check_amount(amount: int) -> None:
    if amount <= 0:
        raise _LedgerError("invalid amount")


def _check_funds(balance: int, amount: int) -> None:
    if amount > balance:
        raise _LedgerError("insufficient funds")


def _apply(balances: dict[str, int], op: BankOp) -> None:
    if op["kind"] == "Open":
        if op["name"] in balances:
            raise _LedgerError(f"duplicate account {op['name']}")
        balances[op["name"]] = 0
    elif op["kind"] == "Deposit":
        _require(balances, op["name"])
        _check_amount(op["amount"])
        balances[op["name"]] += op["amount"]
    elif op["kind"] == "Withdraw":
        _require(balances, op["name"])
        _check_amount(op["amount"])
        _check_funds(balances[op["name"]], op["amount"])
        balances[op["name"]] -= op["amount"]
    elif op["kind"] == "Close":
        _require(balances, op["name"])
        if balances[op["name"]] != 0:
            raise _LedgerError(f"account {op['name']} not empty")
        del balances[op["name"]]
    else:
        _require(balances, op["src"])
        _require(balances, op["dst"])
        if op["src"] == op["dst"]:
            raise _LedgerError("same account")
        _check_amount(op["amount"])
        _check_funds(balances[op["src"]], op["amount"])
        balances[op["src"]] -= op["amount"]
        balances[op["dst"]] += op["amount"]


def bank_ledger(ops: list[BankOp]) -> Ok[list[tuple[str, int]]] | Err:
    """Apply bank operations in order and return final balances.

    The first failing operation stops processing with an error of the form
    "step N: <reason>". Accounts are returned in the order they were opened.
    """
    balances: dict[str, int] = {}
    for step, op in enumerate(ops, start=1):
        try:
            _apply(balances, op)
        except _LedgerError as exc:
            return {"ok": False, "error": f"step {step}: {exc}"}
    return {"ok": True, "value": list(balances.items())}
