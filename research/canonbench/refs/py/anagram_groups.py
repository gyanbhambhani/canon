from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def anagram_groups(words: list[str]) -> list[list[str]]:
    """Group words into anagram classes, keeping classes of two or more.

    Classes are ordered by the position of their first word; members keep
    their input order.
    """
    classes: dict[str, list[str]] = {}
    for word in words:
        classes.setdefault("".join(sorted(word)), []).append(word)
    # dicts preserve insertion order, i.e. the order of each class's first word.
    return [members for members in classes.values() if len(members) >= 2]
