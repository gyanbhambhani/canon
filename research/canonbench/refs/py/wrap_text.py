from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def wrap_text(s: str, width: int) -> list[str]:
    """Greedily wrap the space-separated words of s into lines of at most width."""
    lines: list[str] = []
    current = ""
    for word in s.split(" "):
        if not word:
            continue
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
