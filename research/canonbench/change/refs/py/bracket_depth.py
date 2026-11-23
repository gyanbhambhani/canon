from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


_PAIRS: dict[str, str] = {")": "(", "]": "[", "}": "{"}
_OPENERS = frozenset(_PAIRS.values())


def bracket_depth(s: str) -> Ok[int] | Err:
    """Return the maximum bracket nesting depth of s (ignoring quoted text), or a matching error."""
    stack: list[str] = []
    deepest = 0
    in_string = False
    for i, ch in enumerate(s):
        if ch == '"':
            in_string = not in_string
        elif in_string:
            continue
        elif ch in _OPENERS:
            stack.append(ch)
            deepest = max(deepest, len(stack))
        elif ch in _PAIRS:
            if not stack or stack[-1] != _PAIRS[ch]:
                return {"ok": False, "error": f"mismatch at {i}"}
            stack.pop()
    if in_string:
        return {"ok": False, "error": "unclosed string"}
    if stack:
        return {"ok": False, "error": "unclosed at end"}
    return {"ok": True, "value": deepest}
