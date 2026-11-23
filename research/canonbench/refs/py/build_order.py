from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Job(TypedDict):
    name: str
    deps: list[str]


def _first_duplicate(names: list[str]) -> str | None:
    seen: set[str] = set()
    for name in names:
        if name in seen:
            return name
        seen.add(name)
    return None


def build_order(jobs: list[Job]) -> Ok[list[str]] | Err:
    """Return a dependency-respecting order, preferring earlier jobs.

    At each step the earliest-listed job whose dependencies are all placed
    is placed next.
    """
    names = [job["name"] for job in jobs]
    duplicate = _first_duplicate(names)
    if duplicate is not None:
        return {"ok": False, "error": f"duplicate job: {duplicate}"}

    known = set(names)
    for job in jobs:
        for dep in job["deps"]:
            if dep not in known:
                return {"ok": False, "error": f"unknown dependency: {dep}"}

    placed: set[str] = set()
    order: list[str] = []
    remaining = list(jobs)
    while remaining:
        ready = next(
            (i for i, job in enumerate(remaining) if all(d in placed for d in job["deps"])),
            None,
        )
        if ready is None:
            return {"ok": False, "error": "cycle detected"}
        job = remaining.pop(ready)
        placed.add(job["name"])
        order.append(job["name"])
    return {"ok": True, "value": order}
