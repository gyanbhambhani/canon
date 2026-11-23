from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def spiral_order(m: list[list[int]], clockwise: bool) -> list[int]:
    """Elements of a rectangular matrix in spiral order from the top-left."""
    if clockwise:
        # A clockwise spiral of m is the counterclockwise spiral of its transpose.
        m = [list(col) for col in zip(*m)]
    if not m or not m[0]:
        return []

    top, bottom = 0, len(m) - 1
    left, right = 0, len(m[0]) - 1
    out: list[int] = []
    while top <= bottom and left <= right:
        # Down the left column.
        out.extend(m[r][left] for r in range(top, bottom + 1))
        # Right along the bottom row.
        out.extend(m[bottom][c] for c in range(left + 1, right + 1))
        # Up the right column (if it is a different column).
        if left < right:
            out.extend(m[r][right] for r in range(bottom - 1, top - 1, -1))
        # Left along the top row (if it is a different row).
        if top < bottom:
            out.extend(m[top][c] for c in range(right - 1, left, -1))
        top, bottom = top + 1, bottom - 1
        left, right = left + 1, right - 1
    return out
