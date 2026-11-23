from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def elevator_scan(start: int, requests: list[int], direction: str) -> list[int]:
    """Return the order in which an elevator serves requested floors (SCAN)."""
    floors = set(requests)
    here = [start] if start in floors else []
    above = sorted(f for f in floors if f > start)
    below = sorted((f for f in floors if f < start), reverse=True)
    if direction == "up":
        return here + above + below
    return here + below + above
