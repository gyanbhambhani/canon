from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Insert(TypedDict):
    kind: Literal["Insert"]
    text: str

class Delete(TypedDict):
    kind: Literal["Delete"]
    n: int

class Left(TypedDict):
    kind: Literal["Left"]
    n: int

class Right(TypedDict):
    kind: Literal["Right"]
    n: int

class Undo(TypedDict):
    kind: Literal["Undo"]

class Redo(TypedDict):
    kind: Literal["Redo"]

EditOp = Insert | Delete | Left | Right | Undo | Redo


def text_editor(ops: list[EditOp]) -> str:
    """Apply editing operations to an initially empty line and return the final text."""
    text = ""
    cursor = 0
    history: list[tuple[str, int]] = []
    redo: list[tuple[str, int]] = []
    for op in ops:
        if op["kind"] == "Insert":
            history.append((text, cursor))
            redo.clear()
            text = text[:cursor] + op["text"] + text[cursor:]
            cursor += len(op["text"])
        elif op["kind"] == "Delete":
            history.append((text, cursor))
            redo.clear()
            removed = min(op["n"], cursor)
            text = text[: cursor - removed] + text[cursor:]
            cursor -= removed
        elif op["kind"] == "Left":
            cursor = max(cursor - op["n"], 0)
        elif op["kind"] == "Right":
            cursor = min(cursor + op["n"], len(text))
        elif op["kind"] == "Undo":
            if history:
                redo.append((text, cursor))
                text, cursor = history.pop()
        elif redo:
            history.append((text, cursor))
            text, cursor = redo.pop()
    return text
