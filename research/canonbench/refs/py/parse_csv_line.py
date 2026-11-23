from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_csv_line(s: str) -> Ok[list[str]] | Err:
    """Split one CSV line into fields, supporting quoted fields with doubled-quote escapes."""
    fields: list[str] = []
    pos = 0
    while True:
        if pos < len(s) and s[pos] == '"':
            parsed = _quoted_field(s, pos)
        else:
            parsed = _unquoted_field(s, pos)
        if isinstance(parsed, str):
            return {"ok": False, "error": parsed}
        value, end = parsed
        fields.append(value)
        if end == len(s):
            return {"ok": True, "value": fields}
        pos = end + 1  # skip the comma


def _quoted_field(s: str, start: int) -> tuple[str, int] | str:
    """Parse a quoted field at start; return (value, index after it) or an error."""
    chars: list[str] = []
    pos = start + 1
    while pos < len(s):
        if s[pos] != '"':
            chars.append(s[pos])
            pos += 1
        elif s.startswith('""', pos):
            chars.append('"')
            pos += 2
        else:
            after = pos + 1
            if after < len(s) and s[after] != ",":
                return f"expected comma at {after}"
            return "".join(chars), after
    return "unterminated quote"


def _unquoted_field(s: str, start: int) -> tuple[str, int] | str:
    """Parse an unquoted field at start; return (value, index of comma or end) or an error."""
    end = s.find(",", start)
    if end == -1:
        end = len(s)
    quote = s.find('"', start, end)
    if quote != -1:
        return f"unexpected quote at {quote}"
    return s[start:end], end
