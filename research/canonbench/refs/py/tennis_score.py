from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


POINT_NAMES = ("love", "15", "30", "40")


def _winner(a: int, b: int) -> str | None:
    if a >= 4 and a - b >= 2:
        return "A"
    if b >= 4 and b - a >= 2:
        return "B"
    return None


def tennis_score(points: str) -> str:
    """Describe the score of one tennis game after the given sequence of points."""
    a = b = 0
    for ch in points:
        if _winner(a, b) is not None:
            return "error: point after game"
        if ch == "A":
            a += 1
        elif ch == "B":
            b += 1
        else:
            return "error: bad point"

    winner = _winner(a, b)
    if winner is not None:
        return f"game {winner}"
    if a >= 3 and b >= 3:
        if a == b:
            return "deuce"
        return f"advantage {'A' if a > b else 'B'}"
    if a == b:
        return f"{POINT_NAMES[a]}-all"
    return f"{POINT_NAMES[a]}-{POINT_NAMES[b]}"
