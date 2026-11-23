from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


LINES: list[list[tuple[int, int]]] = (
    [[(r, c) for c in range(3)] for r in range(3)]
    + [[(r, c) for r in range(3)] for c in range(3)]
    + [[(i, i) for i in range(3)], [(i, 2 - i) for i in range(3)]]
)


def _has_line(board: list[str], player: str) -> bool:
    return any(all(board[r][c] == player for r, c in line) for line in LINES)


def tic_tac_toe(board: list[str]) -> str:
    """Classify a tic-tac-toe position as invalid, won, drawn or in progress."""
    cells = "".join(board)
    xs, os = cells.count("X"), cells.count("O")
    x_line, o_line = _has_line(board, "X"), _has_line(board, "O")

    if xs - os not in (0, 1):
        return "invalid"
    if x_line and o_line:
        return "invalid"
    if x_line and xs != os + 1:
        return "invalid"
    if o_line and xs != os:
        return "invalid"

    if x_line:
        return "X wins"
    if o_line:
        return "O wins"
    if "." not in cells:
        return "draw"
    return "in progress"
