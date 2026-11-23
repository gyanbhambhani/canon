from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Player(TypedDict):
    name: str
    score: int


def competition_rank(players: list[Player]) -> list[tuple[int, str]]:
    """Assign standard competition ("1224") ranks, highest score first."""
    ordered = sorted(players, key=lambda p: (-p["score"], p["name"]))
    result: list[tuple[int, str]] = []
    rank = 0
    for i, player in enumerate(ordered):
        if i == 0 or player["score"] != ordered[i - 1]["score"]:
            rank = i + 1
        result.append((rank, player["name"]))
    return result
