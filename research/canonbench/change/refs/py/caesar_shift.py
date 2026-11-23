from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


_ALPHABET = "abcdefghijklmnopqrstuvwxyz"
_UPPER = _ALPHABET.upper()


def caesar_shift(s: str, k: int) -> str:
    """Shift each ASCII letter in s by k places, wrapping around and keeping its case."""
    shift = k % len(_ALPHABET)
    table = str.maketrans(
        _ALPHABET + _UPPER,
        _ALPHABET[shift:] + _ALPHABET[:shift] + _UPPER[shift:] + _UPPER[:shift],
    )
    return s.translate(table)
