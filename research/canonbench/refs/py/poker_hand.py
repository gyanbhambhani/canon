from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

from collections import Counter

RANKS = "23456789TJQKA"
SUITS = "CDHS"


def _is_valid_card(card: str) -> bool:
    return len(card) == 2 and card[0] in RANKS and card[1] in SUITS


def _is_straight(ranks: list[int]) -> bool:
    values = sorted(ranks)
    if len(set(values)) != 5:
        return False
    if values[-1] - values[0] == 4:
        return True
    # Ace-low straight: A2345.
    return values == [0, 1, 2, 3, 12]


def poker_hand(cards: list[str]) -> str:
    """Classify a five-card poker hand, or return "invalid"."""
    if len(cards) != 5 or len(set(cards)) != 5 or not all(map(_is_valid_card, cards)):
        return "invalid"

    ranks = [RANKS.index(card[0]) for card in cards]
    flush = len({card[1] for card in cards}) == 1
    straight = _is_straight(ranks)
    shape = sorted(Counter(ranks).values(), reverse=True)

    if straight and flush:
        return "straight flush"
    if shape[0] == 4:
        return "four of a kind"
    if shape == [3, 2]:
        return "full house"
    if flush:
        return "flush"
    if straight:
        return "straight"
    if shape[0] == 3:
        return "three of a kind"
    if shape[:2] == [2, 2]:
        return "two pair"
    if shape[0] == 2:
        return "one pair"
    return "high card"
