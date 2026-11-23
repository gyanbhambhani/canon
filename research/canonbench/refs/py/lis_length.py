from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def lis_length(xs: list[int]) -> tuple[int, int]:
    """Return (length, number of position choices) of the longest strictly increasing subsequences."""
    if not xs:
        return (0, 0)
    # lengths[i] / counts[i]: best length and number of ways for subsequences ending at i.
    lengths = [1] * len(xs)
    counts = [1] * len(xs)
    for i, x in enumerate(xs):
        for j in range(i):
            if xs[j] >= x:
                continue
            if lengths[j] + 1 > lengths[i]:
                lengths[i] = lengths[j] + 1
                counts[i] = counts[j]
            elif lengths[j] + 1 == lengths[i]:
                counts[i] += counts[j]
    best = max(lengths)
    total = sum(count for length, count in zip(lengths, counts) if length == best)
    return (best, total)
