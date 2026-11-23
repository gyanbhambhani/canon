from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


from collections import deque


def sliding_window_max(xs: list[int], k: int) -> Ok[list[int]] | Err:
    """Maximum of each window of k consecutive elements, using a monotonic deque."""
    if k < 1:
        return {"ok": False, "error": "window must be positive"}
    if k > len(xs):
        return {"ok": False, "error": "window larger than input"}

    window: deque[int] = deque()  # indices whose values are strictly decreasing
    maxima: list[int] = []
    for i, x in enumerate(xs):
        while window and xs[window[-1]] <= x:
            window.pop()
        window.append(i)
        if window[0] <= i - k:
            window.popleft()
        if i >= k - 1:
            maxima.append(xs[window[0]])
    return {"ok": True, "value": maxima}
