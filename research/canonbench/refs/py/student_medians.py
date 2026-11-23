from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Student(TypedDict):
    name: str
    scores: list[int]


def _median(scores: list[int]) -> float:
    ordered = sorted(scores)
    mid = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2


def student_medians(students: list[Student]) -> list[tuple[str, float]]:
    """Median score per student with scores, highest median first, ties by name."""
    medians = [(s["name"], _median(s["scores"])) for s in students if s["scores"]]
    return sorted(medians, key=lambda pair: (-pair[1], pair[0]))
