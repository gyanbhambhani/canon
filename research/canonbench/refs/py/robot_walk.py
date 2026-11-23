from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Forward(TypedDict):
    kind: Literal["Forward"]
    steps: int

class TurnLeft(TypedDict):
    kind: Literal["TurnLeft"]

class TurnRight(TypedDict):
    kind: Literal["TurnRight"]

Cmd = Forward | TurnLeft | TurnRight


HEADINGS = "NESW"
DELTAS: dict[str, tuple[int, int]] = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}


def robot_walk(cmds: list[Cmd], obstacles: list[tuple[int, int]]) -> tuple[int, int, str]:
    """Run the robot's commands and return its final (x, y, direction)."""
    blocked = {(ox, oy) for ox, oy in obstacles}
    x, y, heading = 0, 0, 0
    for cmd in cmds:
        if cmd["kind"] == "TurnLeft":
            heading = (heading - 1) % 4
        elif cmd["kind"] == "TurnRight":
            heading = (heading + 1) % 4
        else:
            dx, dy = DELTAS[HEADINGS[heading]]
            for _ in range(cmd["steps"]):
                nxt = (x + dx, y + dy)
                if nxt in blocked:
                    break
                x, y = nxt
    return (x, y, HEADINGS[heading])
