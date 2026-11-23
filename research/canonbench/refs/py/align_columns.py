from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def align_columns(rows: list[list[str]]) -> list[str]:
    """Render a ragged table with cells padded to their column widths.

    Each row uses only its own cells, joined by " | ", with trailing
    spaces stripped from the end of the line.
    """
    widths: list[int] = []
    for row in rows:
        for j, cell in enumerate(row):
            if j == len(widths):
                widths.append(len(cell))
            else:
                widths[j] = max(widths[j], len(cell))

    return [
        " | ".join(cell.ljust(widths[j]) for j, cell in enumerate(row)).rstrip(" ")
        for row in rows
    ]
