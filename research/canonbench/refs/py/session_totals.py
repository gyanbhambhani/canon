from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Session(TypedDict):
    user: str
    kind: str
    time: int


def session_totals(events: list[Session]) -> list[tuple[str, int]]:
    """Total logged-in time per user, sorted by user name."""
    totals: dict[str, int] = {}
    open_since: dict[str, int] = {}
    for event in events:
        user, time = event["user"], event["time"]
        totals.setdefault(user, 0)
        if event["kind"] == "login":
            open_since.setdefault(user, time)
        elif user in open_since:
            totals[user] += time - open_since.pop(user)

    if events:
        end = events[-1]["time"]
        for user, start in open_since.items():
            totals[user] += end - start

    return sorted(totals.items())
