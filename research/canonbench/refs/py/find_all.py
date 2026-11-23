from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def find_all(s: str, pat: str) -> list[int]:
    """Return the start index of every (possibly overlapping) occurrence of pat in s."""
    if not pat:
        return []
    positions: list[int] = []
    i = s.find(pat)
    while i != -1:
        positions.append(i)
        i = s.find(pat, i + 1)
    return positions
