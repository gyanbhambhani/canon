from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

from itertools import groupby


def rle_compress(s: str) -> str:
    """Run-length encode s, returning s itself unless the encoding is strictly shorter."""
    parts: list[str] = []
    for ch, run in groupby(s):
        length = sum(1 for _ in run)
        parts.append(ch if length == 1 else f"{ch}{length}")
    encoded = "".join(parts)
    return encoded if len(encoded) < len(s) else s
