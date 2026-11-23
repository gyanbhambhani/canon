from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Shift(TypedDict):
    worker: str
    start_hour: int
    end_hour: int


HOURS_PER_DAY = 24


def coverage_gaps(shifts: list[Shift], required: int) -> list[int]:
    """Return the hours of the day staffed by fewer than required distinct workers."""
    on_duty: list[set[str]] = [set() for _ in range(HOURS_PER_DAY)]
    for shift in shifts:
        for hour in range(max(shift["start_hour"], 0), min(shift["end_hour"], HOURS_PER_DAY)):
            on_duty[hour].add(shift["worker"])
    return [hour for hour, workers in enumerate(on_duty) if len(workers) < required]
