from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

from collections import Counter


def k_most_frequent(xs: list[int], k: int) -> list[tuple[int, int]]:
    """Return the k most frequent (value, count) pairs, by count desc then value asc."""
    if k <= 0:
        return []
    ranked = sorted(Counter(xs).items(), key=lambda pair: (-pair[1], pair[0]))
    return ranked[:k]
