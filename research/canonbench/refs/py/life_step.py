from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def life_step(grid: list[str], steps: int) -> list[str]:
    """Advance a bounded Game of Life grid by the given number of generations."""
    cells = [[ch == "#" for ch in row] for row in grid]
    for _ in range(steps):
        cells = _next_generation(cells)
    return ["".join("#" if alive else "." for alive in row) for row in cells]


def _next_generation(cells: list[list[bool]]) -> list[list[bool]]:
    """Compute one simultaneous update; cells beyond the edge are dead."""
    height = len(cells)
    width = len(cells[0]) if cells else 0

    def live_neighbours(r: int, c: int) -> int:
        return sum(
            cells[nr][nc]
            for nr in range(max(0, r - 1), min(height, r + 2))
            for nc in range(max(0, c - 1), min(width, c + 2))
            if (nr, nc) != (r, c)
        )

    def survives(r: int, c: int) -> bool:
        n = live_neighbours(r, c)
        return n == 3 or (cells[r][c] and n == 2)

    return [[survives(r, c) for c in range(width)] for r in range(height)]
