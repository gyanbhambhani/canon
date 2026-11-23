from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


import re

_VERSION = re.compile(r"[vV]?([0-9]+(?:\.[0-9]+){0,3})")


def _parse(version: str) -> list[int] | None:
    match = _VERSION.fullmatch(version)
    if match is None:
        return None
    return [int(part) for part in match.group(1).split(".")]


def compare_versions(a: str, b: str) -> Ok[int] | Err:
    """Compare two dotted versions numerically, padding missing parts with 0."""
    pa = _parse(a)
    if pa is None:
        return {"ok": False, "error": f"bad version: {a}"}
    pb = _parse(b)
    if pb is None:
        return {"ok": False, "error": f"bad version: {b}"}
    size = max(len(pa), len(pb))
    pa += [0] * (size - len(pa))
    pb += [0] * (size - len(pb))
    return {"ok": True, "value": (pa > pb) - (pa < pb)}
