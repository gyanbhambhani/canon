from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def next_permutation(xs: list[int]) -> list[int]:
    """Return the next distinct lexicographic arrangement of xs, wrapping to ascending order."""
    result = list(xs)
    pivot = len(result) - 2
    while pivot >= 0 and result[pivot] >= result[pivot + 1]:
        pivot -= 1
    if pivot >= 0:
        successor = len(result) - 1
        while result[successor] <= result[pivot]:
            successor -= 1
        result[pivot], result[successor] = result[successor], result[pivot]
    # The suffix after the pivot is non-increasing; reversing makes it the smallest arrangement.
    result[pivot + 1 :] = reversed(result[pivot + 1 :])
    return result
