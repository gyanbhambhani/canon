from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Person(TypedDict):
    name: str
    age: int


def _bucket_label(bucket: int, width: int) -> str:
    low = bucket * width
    return f"{low}-{low + width - 1}"


def age_histogram(people: list[Person], width: int) -> Ok[list[tuple[str, int]]] | Err:
    """Count people into consecutive age buckets of the given width.

    Returns every bucket from the lowest to the highest occupied one,
    including empty buckets in between.
    """
    if width < 1:
        return {"ok": False, "error": "bad width"}
    for person in people:
        if person["age"] < 0:
            return {"ok": False, "error": f"negative age: {person['name']}"}
    if not people:
        return {"ok": True, "value": []}

    counts: dict[int, int] = {}
    for person in people:
        bucket = person["age"] // width
        counts[bucket] = counts.get(bucket, 0) + 1

    histogram = [
        (_bucket_label(b, width), counts.get(b, 0))
        for b in range(min(counts), max(counts) + 1)
    ]
    return {"ok": True, "value": histogram}
