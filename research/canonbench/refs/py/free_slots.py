from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Meeting(TypedDict):
    start: int
    end: int


def free_slots(meetings: list[Meeting], day_start: int, day_end: int) -> list[tuple[int, int]]:
    """Return the maximal free half-open intervals of the working day."""
    if day_end <= day_start:
        return []
    # Clip every meeting to the day; meetings outside it become empty and are dropped.
    busy = sorted(
        (start, end)
        for start, end in (
            (max(m["start"], day_start), min(m["end"], day_end)) for m in meetings
        )
        if end > start
    )
    free: list[tuple[int, int]] = []
    cursor = day_start
    for start, end in busy:
        if start > cursor:
            free.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < day_end:
        free.append((cursor, day_end))
    return free
