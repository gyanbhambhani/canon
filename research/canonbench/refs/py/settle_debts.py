from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Expense(TypedDict):
    payer: str
    amount_cents: int


def _initial_balances(expenses: list[Expense], people: list[str]) -> list[int]:
    index = {name: i for i, name in enumerate(people)}
    paid = [0] * len(people)
    for expense in expenses:
        paid[index[expense["payer"]]] += expense["amount_cents"]

    share, extra = divmod(sum(paid), len(people))
    return [paid[i] - (share + (1 if i < extra else 0)) for i in range(len(people))]


def settle_debts(expenses: list[Expense], people: list[str]) -> list[tuple[str, str, int]]:
    """Greedily settle shared expenses, returning (from, to, amount) payments in order."""
    balances = _initial_balances(expenses, people)
    payments: list[tuple[str, str, int]] = []
    while any(balances):
        # min/max return the first index on ties, matching the people order.
        debtor = min(range(len(people)), key=lambda i: balances[i])
        creditor = max(range(len(people)), key=lambda i: balances[i])
        amount = min(-balances[debtor], balances[creditor])
        balances[debtor] += amount
        balances[creditor] -= amount
        payments.append((people[debtor], people[creditor], amount))
    return payments
