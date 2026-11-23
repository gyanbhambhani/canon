from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


class _Invalid(Exception):
    def __init__(self, pos: int) -> None:
        super().__init__(f"invalid at {pos}")
        self.pos = pos


def _is_digit(ch: str | None) -> bool:
    return ch is not None and "0" <= ch <= "9"


class _Parser:
    """Recursive-descent parser that collects integers and the deepest list level."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.pos = 0
        self.values: list[int] = []
        self.max_depth = 0

    def _peek(self) -> str | None:
        return self.text[self.pos] if self.pos < len(self.text) else None

    def _expect(self, ch: str) -> None:
        if self._peek() != ch:
            raise _Invalid(self.pos)
        self.pos += 1

    def parse(self) -> None:
        self._list(1)
        if self.pos != len(self.text):
            raise _Invalid(self.pos)

    def _list(self, depth: int) -> None:
        self._expect("[")
        self.max_depth = max(self.max_depth, depth)
        if self._peek() == "]":
            self.pos += 1
            return
        self._element(depth)
        while self._peek() == ",":
            self.pos += 1
            self._element(depth)
        self._expect("]")

    def _element(self, depth: int) -> None:
        if self._peek() == "[":
            self._list(depth + 1)
        else:
            self._integer()

    def _integer(self) -> None:
        start = self.pos
        if self._peek() == "-":
            self.pos += 1
        if not _is_digit(self._peek()):
            raise _Invalid(self.pos)
        while _is_digit(self._peek()):
            self.pos += 1
        self.values.append(int(self.text[start:self.pos]))


def flatten_nested(s: str) -> Ok[tuple[list[int], int]] | Err:
    """Flatten a textual nested integer list and report its maximum depth."""
    parser = _Parser(s.replace(" ", ""))
    try:
        parser.parse()
    except _Invalid as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "value": (parser.values, parser.max_depth)}
