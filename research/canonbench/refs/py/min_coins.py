from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def min_coins(coins: list[int], amount: int) -> tuple[int, list[int]] | None:
    """Fewest coins summing to amount; among ties, the lexicographically greatest descending list."""
    if amount < 0:
        return None
    values = sorted(set(coins), reverse=True)
    unreachable = amount + 1
    fewest = [0] + [unreachable] * amount
    for total in range(1, amount + 1):
        for coin in values:
            if coin <= total and fewest[total - coin] + 1 < fewest[total]:
                fewest[total] = fewest[total - coin] + 1
    if fewest[amount] == unreachable:
        return None
    used: list[int] = []
    remaining = amount
    while remaining > 0:
        # The largest coin that still allows an optimal finish is the best next element;
        # later picks can never exceed it, so the list stays in descending order.
        coin = next(
            c for c in values if c <= remaining and fewest[remaining - c] == fewest[remaining] - 1
        )
        used.append(coin)
        remaining -= coin
    return (len(used), used)
