from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Num(TypedDict):
    kind: Literal["Num"]
    value: int

class Ident(TypedDict):
    kind: Literal["Ident"]
    name: str

class Sym(TypedDict):
    kind: Literal["Sym"]
    text: str

class Str(TypedDict):
    kind: Literal["Str"]
    text: str

Token = Num | Ident | Sym | Str


TWO_CHAR_SYMBOLS = frozenset({"==", "<=", ">=", "!="})
ONE_CHAR_SYMBOLS = frozenset("+-*/=<>(),")


def _is_digit(ch: str) -> bool:
    return "0" <= ch <= "9"


def _is_ident_start(ch: str) -> bool:
    return "a" <= ch <= "z" or ch == "_"


def _is_ident_char(ch: str) -> bool:
    return _is_ident_start(ch) or _is_digit(ch)


def _scan_while(s: str, start: int, pred: Callable[[str], bool]) -> int:
    end = start
    while end < len(s) and pred(s[end]):
        end += 1
    return end


def tokenize(s: str) -> Ok[list[Token]] | Err:
    """Split s into number, identifier and symbol tokens."""
    tokens: list[Token] = []
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == " ":
            i += 1
        elif _is_digit(ch):
            end = _scan_while(s, i, _is_digit)
            tokens.append({"kind": "Num", "value": int(s[i:end])})
            i = end
        elif _is_ident_start(ch):
            end = _scan_while(s, i, _is_ident_char)
            tokens.append({"kind": "Ident", "name": s[i:end]})
            i = end
        elif ch == '"':
            end = s.find('"', i + 1)
            if end < 0:
                return {"ok": False, "error": f"unterminated string at {i}"}
            tokens.append({"kind": "Str", "text": s[i + 1 : end]})
            i = end + 1
        elif s[i : i + 2] in TWO_CHAR_SYMBOLS:
            tokens.append({"kind": "Sym", "text": s[i : i + 2]})
            i += 2
        elif ch in ONE_CHAR_SYMBOLS:
            tokens.append({"kind": "Sym", "text": ch})
            i += 1
        else:
            return {"ok": False, "error": f"unexpected character: {ch} at {i}"}
    return {"ok": True, "value": tokens}
