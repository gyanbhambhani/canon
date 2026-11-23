from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


VOWELS = frozenset("aeiou")


def _is_vowel(word: str, i: int) -> bool:
    ch = word[i]
    if ch == "y":
        return i > 0
    if ch == "u" and i > 0 and word[i - 1] == "q":
        return False
    return ch in VOWELS


def _translate_word(word: str) -> str:
    first_vowel = next((i for i in range(len(word)) if _is_vowel(word, i)), None)
    if first_vowel is None:
        return word + "ay"
    if first_vowel == 0:
        return word + "way"
    return word[first_vowel:] + word[:first_vowel] + "ay"


def pig_latin(s: str) -> str:
    """Translate a space-separated string of lowercase words into Pig Latin."""
    if not s:
        return ""
    return " ".join(_translate_word(word) for word in s.split(" "))
