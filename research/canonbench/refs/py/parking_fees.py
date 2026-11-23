from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Arrive(TypedDict):
    kind: Literal["Arrive"]
    plate: str
    minute: int

class Leave(TypedDict):
    kind: Literal["Leave"]
    plate: str
    minute: int

Park = Arrive | Leave


def parking_fees(events: list[Park]) -> list[tuple[str, int]]:
    """Total the fees of completed stays per plate, sorted by plate."""
    parked: dict[str, int] = {}
    totals: dict[str, int] = {}
    for event in events:
        plate = event["plate"]
        if event["kind"] == "Arrive":
            parked.setdefault(plate, event["minute"])
        elif plate in parked:
            arrival = parked.pop(plate)
            totals[plate] = totals.get(plate, 0) + _stay_fee(event["minute"] - arrival)
    return sorted(totals.items())


def _stay_fee(duration: int) -> int:
    """30 free minutes, then 200 per started hour, capped at 1000."""
    if duration <= 30:
        return 0
    started_hours = -(-(duration - 30) // 60)
    return min(1000, 200 * started_hours)
