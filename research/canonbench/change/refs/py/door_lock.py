from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Digit(TypedDict):
    kind: Literal["Digit"]
    d: int

class Enter(TypedDict):
    kind: Literal["Enter"]

class Clear(TypedDict):
    kind: Literal["Clear"]

class Reset(TypedDict):
    kind: Literal["Reset"]

Key = Digit | Enter | Clear | Reset


from collections import deque

MAX_FAILURES = 3


def door_lock(code: str, events: list[Key]) -> str:
    """Simulate a keypad lock and return its final state."""
    state = "locked"
    buffer: deque[str] = deque(maxlen=len(code))
    failures = 0
    for event in events:
        if state == "blocked":
            if event["kind"] == "Reset":
                state = "locked"
                buffer.clear()
                failures = 0
            continue
        if state == "open":
            if event["kind"] == "Enter":
                state = "locked"
                buffer.clear()
            continue
        if event["kind"] == "Digit":
            buffer.append(str(event["d"]))
        elif event["kind"] == "Clear":
            buffer.clear()
        elif event["kind"] == "Enter":
            if "".join(buffer) == code:
                state = "open"
                failures = 0
            else:
                failures += 1
                if failures >= MAX_FAILURES:
                    state = "blocked"
            buffer.clear()
    return state
