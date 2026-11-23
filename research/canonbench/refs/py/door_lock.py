from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Digit(TypedDict):
    kind: Literal["Digit"]
    d: int

class Enter(TypedDict):
    kind: Literal["Enter"]

class Clear(TypedDict):
    kind: Literal["Clear"]

Key = Digit | Enter | Clear


from collections import deque

MAX_FAILURES = 3


def door_lock(code: str, events: list[Key]) -> str:
    """Simulate a keypad lock and return its final state."""
    state = "locked"
    buffer: deque[str] = deque(maxlen=len(code))
    failures = 0
    for event in events:
        if state == "blocked":
            break
        if state == "open":
            if event["kind"] == "Enter":
                state = "locked"
                buffer.clear()
            continue
        if event["kind"] == "Digit":
            buffer.append(str(event["d"]))
        elif event["kind"] == "Clear":
            buffer.clear()
        else:
            if "".join(buffer) == code:
                state = "open"
                failures = 0
            else:
                failures += 1
                if failures >= MAX_FAILURES:
                    state = "blocked"
            buffer.clear()
    return state
