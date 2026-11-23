from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


from dataclasses import dataclass


class _ParseError(Exception):
    pass


class _DivisionByZero(Exception):
    pass


@dataclass(frozen=True)
class _Num:
    value: int


@dataclass(frozen=True)
class _BinOp:
    op: str
    left: _Num | _BinOp
    right: _Num | _BinOp


_Node = _Num | _BinOp


def _is_digit(ch: str | None) -> bool:
    return ch is not None and "0" <= ch <= "9"


class _Parser:
    """Recursive-descent parser for the expression grammar."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.pos = 0

    def _peek(self) -> str | None:
        return self.text[self.pos] if self.pos < len(self.text) else None

    def _fail(self) -> _ParseError:
        ch = self._peek()
        if ch is None:
            return _ParseError("unexpected end")
        return _ParseError(f"unexpected character: {ch}")

    def parse(self) -> _Node:
        node = self._expr()
        if self._peek() is not None:
            raise self._fail()
        return node

    def _expr(self) -> _Node:
        node = self._term()
        while (op := self._peek()) in ("+", "-"):
            assert op is not None
            self.pos += 1
            node = _BinOp(op, node, self._term())
        return node

    def _term(self) -> _Node:
        node = self._factor()
        while (op := self._peek()) in ("*", "/", "%"):
            assert op is not None
            self.pos += 1
            node = _BinOp(op, node, self._factor())
        return node

    def _factor(self) -> _Node:
        if self._peek() == "(":
            self.pos += 1
            node = self._expr()
            if self._peek() != ")":
                raise self._fail()
            self.pos += 1
            return node
        if not _is_digit(self._peek()):
            raise self._fail()
        start = self.pos
        while _is_digit(self._peek()):
            self.pos += 1
        return _Num(int(self.text[start:self.pos]))


def _evaluate(node: _Node) -> int:
    if isinstance(node, _Num):
        return node.value
    left = _evaluate(node.left)
    right = _evaluate(node.right)
    if node.op == "+":
        return left + right
    if node.op == "-":
        return left - right
    if node.op == "*":
        return left * right
    if right == 0:
        raise _DivisionByZero()
    quotient = abs(left) // abs(right)
    if (left < 0) != (right < 0):
        quotient = -quotient
    if node.op == "%":
        return left - right * quotient
    return quotient


def eval_expr(s: str) -> Ok[int] | Err:
    """Parse and evaluate an integer expression with + - * / % and parentheses.

    Syntax errors are reported before any evaluation; division truncates
    toward zero and % takes the sign of the dividend.
    """
    try:
        tree = _Parser(s.replace(" ", "")).parse()
    except _ParseError as exc:
        return {"ok": False, "error": str(exc)}
    try:
        return {"ok": True, "value": _evaluate(tree)}
    except _DivisionByZero:
        return {"ok": False, "error": "division by zero"}
