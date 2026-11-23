from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def wrap_text(s: str, width: int) -> list[str]:
    """Greedily wrap the space-separated words of s into lines of at most width."""
    lines: list[str] = []
    current = ""
    # Cut words longer than width into width-sized pieces; each piece wraps like a word.
    pieces = [w[i : i + width] for w in s.split(" ") for i in range(0, len(w), width)]
    for word in pieces:
        if not current:
            current = word
        elif len(current) + 1 + len(word) <= width:
            current = f"{current} {word}"
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines
