from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def heading_numbers(lines: list[str]) -> list[str]:
    """Number level 1-3 Markdown headings hierarchically, e.g. "1.2.1 Title"."""
    counters = [0, 0, 0]
    out: list[str] = []
    for line in lines:
        heading = _parse_heading(line)
        if heading is None:
            continue
        level, title = heading
        counters[level - 1] += 1
        for deeper in range(level, len(counters)):
            counters[deeper] = 0
        number = ".".join(str(c) for c in counters[:level])
        out.append(f"{number} {title}")
    return out


def _parse_heading(line: str) -> tuple[int, str] | None:
    """Return (level, title) if line is a valid heading, else None."""
    level = len(line) - len(line.lstrip("#"))
    if not 1 <= level <= 3:
        return None
    rest = line[level:]
    if not rest.startswith(" ") or len(rest) < 2:
        return None
    return level, rest[1:]
