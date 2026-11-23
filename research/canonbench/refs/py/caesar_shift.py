from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


_ALPHABET = "abcdefghijklmnopqrstuvwxyz"


def caesar_shift(s: str, k: int) -> str:
    """Shift each lowercase ASCII letter in s by k places, wrapping around."""
    shift = k % len(_ALPHABET)
    table = str.maketrans(_ALPHABET, _ALPHABET[shift:] + _ALPHABET[:shift])
    return s.translate(table)
