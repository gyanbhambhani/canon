from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


class _GameError(Exception):
    pass


def _roll(rolls: list[int], i: int) -> int:
    if i >= len(rolls):
        raise _GameError("incomplete game")
    return rolls[i]


def _frame_starts(rolls: list[int]) -> list[int]:
    """Validate the game frame by frame and return the index where each frame starts."""
    starts: list[int] = []
    i = 0
    for frame in range(1, 10):
        starts.append(i)
        if _roll(rolls, i) == 10:
            i += 1
            continue
        if _roll(rolls, i) + _roll(rolls, i + 1) > 10:
            raise _GameError(f"too many pins in frame {frame}")
        i += 2

    starts.append(i)
    first = _roll(rolls, i)
    if first == 10:
        bonus1, bonus2 = _roll(rolls, i + 1), _roll(rolls, i + 2)
        if bonus1 != 10 and bonus1 + bonus2 > 10:
            raise _GameError("too many pins in frame 10")
        i += 3
    else:
        second = _roll(rolls, i + 1)
        if first + second > 10:
            raise _GameError("too many pins in frame 10")
        if first + second == 10:
            _roll(rolls, i + 2)
            i += 3
        else:
            i += 2
    if i < len(rolls):
        raise _GameError("too many rolls")
    return starts


def bowling_score(rolls: list[int]) -> Ok[int] | Err:
    """Validate and score a complete ten-pin bowling game."""
    if any(roll < 0 or roll > 10 for roll in rolls):
        return {"ok": False, "error": "invalid roll"}
    try:
        starts = _frame_starts(rolls)
    except _GameError as exc:
        return {"ok": False, "error": str(exc)}

    total = 0
    for i in starts[:9]:
        if rolls[i] == 10:
            total += 10 + rolls[i + 1] + rolls[i + 2]
        elif rolls[i] + rolls[i + 1] == 10:
            total += 10 + rolls[i + 2]
        else:
            total += rolls[i] + rolls[i + 1]
    total += sum(rolls[starts[9]:])
    return {"ok": True, "value": total}
