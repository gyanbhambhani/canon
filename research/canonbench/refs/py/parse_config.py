from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Setting(TypedDict):
    section: str
    key: str
    value: str


def parse_config(lines: list[str]) -> Ok[list[Setting]] | Err:
    """Parse INI-style lines into settings, keeping first-appearance order of (section, key)."""
    # Dicts keep insertion order, and reassigning a key keeps its original position.
    settings: dict[tuple[str, str], str] = {}
    section = ""
    for number, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("["):
            name = line[1:-1].strip() if len(line) >= 2 and line.endswith("]") else ""
            if not name:
                return {"ok": False, "error": f"line {number}: bad header"}
            section = name
            continue
        key, sep, value = line.partition("=")
        if not sep:
            return {"ok": False, "error": f"line {number}: missing ="}
        key = key.strip()
        if not key:
            return {"ok": False, "error": f"line {number}: empty key"}
        settings[(section, key)] = value.strip()
    result: list[Setting] = [
        {"section": sec, "key": key, "value": value} for (sec, key), value in settings.items()
    ]
    return {"ok": True, "value": result}
