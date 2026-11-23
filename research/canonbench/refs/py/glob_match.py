from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


# A compiled pattern token: None stands for "*", "" for "?", otherwise a literal character.
_Token = str | None


def _tokenize(pattern: str) -> list[_Token]:
    tokens: list[_Token] = []
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "\\":
            # A trailing backslash matches a literal backslash.
            tokens.append(pattern[i + 1] if i + 1 < len(pattern) else "\\")
            i += 2
            continue
        if ch == "*":
            tokens.append(None)
        elif ch == "?":
            tokens.append("")
        else:
            tokens.append(ch)
        i += 1
    return tokens


def glob_match(pattern: str, s: str) -> bool:
    """Return whether the whole of s matches the glob pattern.

    Supports "*" (any run), "?" (one character) and backslash escapes.
    """
    # matches[j] is True when the tokens consumed so far match s[:j].
    matches = [True] + [False] * len(s)
    for token in _tokenize(pattern):
        if token is None:
            for j in range(1, len(s) + 1):
                matches[j] = matches[j] or matches[j - 1]
        else:
            matches = [False] + [
                matches[j - 1] and (token == "" or token == s[j - 1])
                for j in range(1, len(s) + 1)
            ]
    return matches[len(s)]
