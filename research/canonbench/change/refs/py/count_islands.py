from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


# All eight surrounding cells: islands connect through diagonals too.
_NEIGHBOURS = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr, dc) != (0, 0)]


def _flood(grid: list[str], seen: set[tuple[int, int]], start: tuple[int, int]) -> int:
    """Mark the island containing start as seen and return its size."""
    rows, cols = len(grid), len(grid[0])
    stack = [start]
    seen.add(start)
    size = 0
    while stack:
        r, c = stack.pop()
        size += 1
        for dr, dc in _NEIGHBOURS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == "#" and (nr, nc) not in seen:
                seen.add((nr, nc))
                stack.append((nr, nc))
    return size


def count_islands(grid: list[str]) -> tuple[int, int]:
    """Return (number of islands, size of the largest island), with 8-way connectivity."""
    seen: set[tuple[int, int]] = set()
    count = 0
    largest = 0
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            if cell == "#" and (r, c) not in seen:
                count += 1
                largest = max(largest, _flood(grid, seen, (r, c)))
    return count, largest
