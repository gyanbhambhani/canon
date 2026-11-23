from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Coin(TypedDict):
    kind: Literal["Coin"]
    cents: int

class Select(TypedDict):
    kind: Literal["Select"]
    price: int

class Refund(TypedDict):
    kind: Literal["Refund"]

Event = Coin | Select | Refund


ACCEPTED_COINS = frozenset({5, 10, 25, 100})


def vending_machine(events: list[Event]) -> list[str]:
    """Simulate the vending machine and return the messages it prints."""
    credit = 0
    messages: list[str] = []
    for event in events:
        if event["kind"] == "Coin":
            if event["cents"] in ACCEPTED_COINS:
                credit += event["cents"]
            else:
                messages.append(f"reject {event['cents']}")
        elif event["kind"] == "Select":
            price = event["price"]
            if credit >= price:
                messages.append(f"vend {price} change {credit - price}")
                credit = 0
            else:
                messages.append(f"insufficient {credit}")
        elif credit > 0:
            messages.append(f"refund {credit}")
            credit = 0
    if credit > 0:
        messages.append(f"refund {credit}")
    return messages
