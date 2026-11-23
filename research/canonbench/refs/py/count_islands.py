from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def _flood(grid: list[str], seen: set[tuple[int, int]], start: tuple[int, int]) -> int:
    """Mark the island containing start as seen and return its size."""
    rows, cols = len(grid), len(grid[0])
    stack = [start]
    seen.add(start)
    size = 0
    while stack:
        r, c = stack.pop()
        size += 1
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == "#" and (nr, nc) not in seen:
                seen.add((nr, nc))
                stack.append((nr, nc))
    return size


def count_islands(grid: list[str]) -> tuple[int, int]:
    """Return (number of islands, size of the largest island) in the grid."""
    seen: set[tuple[int, int]] = set()
    count = 0
    largest = 0
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            if cell == "#" and (r, c) not in seen:
                count += 1
                largest = max(largest, _flood(grid, seen, (r, c)))
    return count, largest
