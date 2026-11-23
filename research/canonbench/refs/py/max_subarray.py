from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def max_subarray(xs: list[int]) -> tuple[int, int, int] | None:
    """Return (sum, start, end) of the maximum-sum non-empty run.

    Ties go to the smallest start, then the smallest end. Uses Kadane's algorithm,
    tracking for each end index the best run ending there with the smallest start.
    """
    if not xs:
        return None
    best = (xs[0], 0, 0)
    current_sum, current_start = xs[0], 0
    for end in range(1, len(xs)):
        # Extending a zero-sum prefix keeps the earlier start, which wins ties.
        if current_sum >= 0:
            current_sum += xs[end]
        else:
            current_sum, current_start = xs[end], end
        best_sum, best_start, _ = best
        if current_sum > best_sum or (current_sum == best_sum and current_start < best_start):
            best = (current_sum, current_start, end)
    return best
