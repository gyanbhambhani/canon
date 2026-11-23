from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Create(TypedDict):
    kind: Literal["Create"]
    id: str

class Pay(TypedDict):
    kind: Literal["Pay"]
    id: str

class Ship(TypedDict):
    kind: Literal["Ship"]
    id: str

class Cancel(TypedDict):
    kind: Literal["Cancel"]
    id: str

class Refund(TypedDict):
    kind: Literal["Refund"]
    id: str

OrderEvent = Create | Pay | Ship | Cancel | Refund


def order_states(events: list[OrderEvent]) -> Ok[list[tuple[str, str]]] | Err:
    """Replay order life-cycle events, stopping at the first invalid one."""
    states: dict[str, str] = {}
    for event in events:
        order_id = event["id"]
        if event["kind"] == "Create":
            if order_id in states:
                return {"ok": False, "error": f"duplicate order: {order_id}"}
            states[order_id] = "created"
            continue
        if order_id not in states:
            return {"ok": False, "error": f"unknown order: {order_id}"}
        verb = event["kind"].lower()
        current = states[order_id]
        target = _TRANSITIONS[verb].get(current)
        if target is None:
            return {"ok": False, "error": f"cannot {verb} {order_id} from {current}"}
        states[order_id] = target
    return {"ok": True, "value": sorted(states.items())}


# For each verb, the states it may be applied in and the state it leads to.
_TRANSITIONS: dict[str, dict[str, str]] = {
    "pay": {"created": "paid"},
    "ship": {"paid": "shipped"},
    "cancel": {"created": "cancelled", "paid": "cancelled"},
    "refund": {"paid": "refunded", "shipped": "refunded"},
}
